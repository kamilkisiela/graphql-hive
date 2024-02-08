import { parse, print } from 'graphql';
import { Inject, Injectable, Scope } from 'graphql-modules';
import lodash from 'lodash';
import promClient from 'prom-client';
import { z } from 'zod';
import { CriticalityLevel } from '@graphql-inspector/core';
import { SchemaChangeType, SchemaCheck } from '@hive/storage';
import * as Sentry from '@sentry/node';
import * as Types from '../../../__generated__/types';
import { Organization, Project, ProjectType, Schema, Target } from '../../../shared/entities';
import { HiveError } from '../../../shared/errors';
import { isGitHubRepositoryString } from '../../../shared/is-github-repository-string';
import { bolderize } from '../../../shared/markdown';
import { sentry } from '../../../shared/sentry';
import { AlertsManager } from '../../alerts/providers/alerts-manager';
import { AuthManager } from '../../auth/providers/auth-manager';
import { TargetAccessScope } from '../../auth/providers/target-access';
import {
  GitHubIntegrationManager,
  type GitHubCheckRun,
} from '../../integrations/providers/github-integration-manager';
import { OrganizationManager } from '../../organization/providers/organization-manager';
import { ProjectManager } from '../../project/providers/project-manager';
import { RateLimitProvider } from '../../rate-limit/providers/rate-limit.provider';
import { DistributedCache } from '../../shared/providers/distributed-cache';
import { Logger } from '../../shared/providers/logger';
import { Mutex } from '../../shared/providers/mutex';
import { Storage, type TargetSelector } from '../../shared/providers/storage';
import { TargetManager } from '../../target/providers/target-manager';
import { toGraphQLSchemaCheck } from '../to-graphql-schema-check';
import { ArtifactStorageWriter } from './artifact-storage-writer';
import type { SchemaModuleConfig } from './config';
import { SCHEMA_MODULE_CONFIG } from './config';
import { Contracts } from './contracts';
import { CompositeModel } from './models/composite';
import { CompositeLegacyModel } from './models/composite-legacy';
import {
  DeleteFailureReasonCode,
  formatPolicyError,
  getReasonByCode,
  PublishFailureReasonCode,
  SchemaCheckConclusion,
  SchemaCheckResult,
  SchemaCheckWarning,
  SchemaDeleteConclusion,
  SchemaPublishConclusion,
  SchemaPublishResult,
} from './models/shared';
import { SingleModel } from './models/single';
import { SingleLegacyModel } from './models/single-legacy';
import { ensureCompositeSchemas, ensureSingleSchema, SchemaHelper } from './schema-helper';
import { SchemaManager } from './schema-manager';
import { SchemaVersionHelper } from './schema-version-helper';

const schemaCheckCount = new promClient.Counter({
  name: 'registry_check_count',
  help: 'Number of schema checks',
  labelNames: ['model', 'projectType', 'conclusion'],
});

const schemaPublishCount = new promClient.Counter({
  name: 'registry_publish_count',
  help: 'Number of schema publishes',
  labelNames: ['model', 'projectType', 'conclusion'],
});

const schemaDeleteCount = new promClient.Counter({
  name: 'registry_delete_count',
  help: 'Number of schema deletes',
  labelNames: ['model', 'projectType'],
});

export type CheckInput = Omit<Types.SchemaCheckInput, 'project' | 'organization' | 'target'> &
  TargetSelector;

export type DeleteInput = Omit<Types.SchemaDeleteInput, 'project' | 'organization' | 'target'> &
  Omit<TargetSelector, 'target'> & {
    checksum: string;
    target: Target;
  };

export type PublishInput = Types.SchemaPublishInput &
  TargetSelector & {
    checksum: string;
    isSchemaPublishMissingUrlErrorSelected: boolean;
  };

type BreakPromise<T> = T extends Promise<infer U> ? U : never;

type PublishResult = BreakPromise<ReturnType<SchemaPublisher['internalPublish']>>;

function registryLockId(targetId: string) {
  return `registry:lock:${targetId}`;
}

function assertNonNull<T>(value: T | null, message: string): T {
  if (value === null) {
    throw new Error(message);
  }
  return value;
}

@Injectable({
  scope: Scope.Operation,
})
export class SchemaPublisher {
  private logger: Logger;
  private models: {
    [ProjectType.SINGLE]: {
      modern: SingleModel;
      legacy: SingleLegacyModel;
    };
    [ProjectType.FEDERATION]: {
      modern: CompositeModel;
      legacy: CompositeLegacyModel;
    };
    [ProjectType.STITCHING]: {
      modern: CompositeModel;
      legacy: CompositeLegacyModel;
    };
  };

  constructor(
    logger: Logger,
    private authManager: AuthManager,
    private storage: Storage,
    private schemaManager: SchemaManager,
    private targetManager: TargetManager,
    private projectManager: ProjectManager,
    private organizationManager: OrganizationManager,
    private alertsManager: AlertsManager,
    private gitHubIntegrationManager: GitHubIntegrationManager,
    private distributedCache: DistributedCache,
    private helper: SchemaHelper,
    private artifactStorageWriter: ArtifactStorageWriter,
    private mutex: Mutex,
    private rateLimit: RateLimitProvider,
    private contracts: Contracts,
    private schemaVersionHelper: SchemaVersionHelper,
    @Inject(SCHEMA_MODULE_CONFIG) private schemaModuleConfig: SchemaModuleConfig,
    singleModel: SingleModel,
    compositeModel: CompositeModel,
    compositeLegacyModel: CompositeLegacyModel,
    singleLegacyModel: SingleLegacyModel,
  ) {
    this.logger = logger.child({ service: 'SchemaPublisher' });
    this.models = {
      [ProjectType.SINGLE]: {
        modern: singleModel,
        legacy: singleLegacyModel,
      },
      [ProjectType.FEDERATION]: {
        modern: compositeModel,
        legacy: compositeLegacyModel,
      },
      [ProjectType.STITCHING]: {
        modern: compositeModel,
        legacy: compositeLegacyModel,
      },
    };
  }

  @sentry('SchemaPublisher.check')
  async check(input: CheckInput) {
    this.logger.info('Checking schema (input=%o)', lodash.omit(input, ['sdl']));

    await this.authManager.ensureTargetAccess({
      target: input.target,
      project: input.project,
      organization: input.organization,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    const [
      target,
      project,
      organization,
      latestVersion,
      latestComposableVersion,
      latestSchemaVersion,
      latestComposableSchemaVersion,
    ] = await Promise.all([
      this.targetManager.getTarget({
        organization: input.organization,
        project: input.project,
        target: input.target,
      }),
      this.projectManager.getProject({
        organization: input.organization,
        project: input.project,
      }),
      this.organizationManager.getOrganization({
        organization: input.organization,
      }),
      this.schemaManager.getLatestSchemas({
        organization: input.organization,
        project: input.project,
        target: input.target,
      }),
      this.schemaManager.getLatestSchemas({
        organization: input.organization,
        project: input.project,
        target: input.target,
        onlyComposable: true,
      }),
      this.schemaManager.getMaybeLatestVersion({
        organization: input.organization,
        project: input.project,
        target: input.target,
      }),
      this.schemaManager.getMaybeLatestValidVersion({
        organization: input.organization,
        project: input.project,
        target: input.target,
      }),
    ]);

    const projectModelVersion = project.legacyRegistryModel ? 'legacy' : 'modern';

    function increaseSchemaCheckCountMetric(conclusion: 'rejected' | 'accepted') {
      schemaCheckCount.inc({
        model: projectModelVersion,
        projectType: project.type,
        conclusion,
      });
    }

    if (
      (project.type === ProjectType.FEDERATION || project.type === ProjectType.STITCHING) &&
      input.service == null
    ) {
      this.logger.debug('No service name provided (type=%s)', project.type, projectModelVersion);
      increaseSchemaCheckCountMetric('rejected');
      return {
        __typename: 'SchemaCheckError',
        valid: false,
        changes: [],
        warnings: [],
        errors: [
          {
            message: 'Missing service name',
          },
        ],
      } as const;
    }

    let githubCheckRun: GitHubCheckRun | null = null;

    {
      let github: null | {
        repository: `${string}/${string}`;
        sha: string;
      } = null;

      if (input.github) {
        if (input.github.repository) {
          if (!isGitHubRepositoryString(input.github.repository)) {
            this.logger.debug(
              'Invalid github repository name provided (repository=%s)',
              input.github.repository,
            );
            increaseSchemaCheckCountMetric('rejected');
            return {
              __typename: 'GitHubSchemaCheckError' as const,
              message: 'Invalid github repository name provided.',
            };
          }
          github = {
            repository: input.github.repository,
            sha: input.github.commit,
          };
        } else if (project.gitRepository == null) {
          this.logger.debug(
            'Git repository is not configured for this project (project=%s)',
            project.id,
          );
          increaseSchemaCheckCountMetric('rejected');
          return {
            __typename: 'GitHubSchemaCheckError' as const,
            message: 'Git repository is not configured for this project.',
          };
        } else {
          github = {
            repository: project.gitRepository,
            sha: input.github.commit,
          };
        }
      }

      if (github != null) {
        const result = await this.createGithubCheckRunStartForSchemaCheck({
          organization,
          project,
          target,
          serviceName: input.service ?? null,
          github: {
            owner: github.repository.split('/')[0],
            repository: github.repository.split('/')[1],
            sha: github.sha,
          },
        });

        if (result.success === false) {
          increaseSchemaCheckCountMetric('rejected');
          return {
            __typename: 'GitHubSchemaCheckError' as const,
            message: result.error,
          };
        }

        githubCheckRun = result.data;
      }
    }

    let contextId: string | null = null;

    if (input.contextId !== undefined) {
      const result = SchemaCheckContextIdModel.safeParse(input.contextId);
      if (!result.success) {
        return {
          __typename: 'SchemaCheckError',
          valid: false,
          changes: [],
          warnings: [],
          errors: [
            {
              message: result.error.errors[0].message,
            },
          ],
        } as const;
      }
      contextId = result.data;
    } else if (input.github?.repository && input.github.pullRequestNumber) {
      contextId = `${input.github.repository}#${input.github.pullRequestNumber}`;
    }

    await this.schemaManager.completeGetStartedCheck({
      organization: project.orgId,
      step: 'checkingSchema',
    });

    const baseSchema = await this.schemaManager.getBaseSchema({
      organization: input.organization,
      project: input.project,
      target: input.target,
    });

    const selector = {
      organization: input.organization,
      project: input.project,
      target: input.target,
    };

    const sdl = tryPrettifySDL(input.sdl);

    const contracts =
      project.type === ProjectType.FEDERATION
        ? await this.contracts.loadActiveContractsWithLatestValidContractVersionsByTargetId({
            targetId: target.id,
          })
        : null;

    let checkResult: SchemaCheckResult;

    let approvedSchemaChanges: Map<string, SchemaChangeType> | null = new Map();
    let approvedContractChanges: Map<string, Map<string, SchemaChangeType>> | null = null;

    if (contextId !== null) {
      approvedSchemaChanges = await this.storage.getApprovedSchemaChangesForContextId({
        targetId: target.id,
        contextId,
      });

      if (contracts?.length) {
        approvedContractChanges = await this.contracts.getApprovedSchemaChangesForContracts({
          contextId,
          contractIds: contracts.map(contract => contract.contract.id),
        });
      }
    }

    const contractVersionIdByContractName = new Map<string, string>();
    contracts?.forEach(contract => {
      if (!contract.latestValidVersion) {
        return;
      }
      contractVersionIdByContractName.set(
        contract.latestValidVersion.contractName,
        contract.latestValidVersion.id,
      );
    });

    switch (project.type) {
      case ProjectType.SINGLE:
        this.logger.debug('Using SINGLE registry model (version=%s)', projectModelVersion);
        checkResult = await this.models[ProjectType.SINGLE][projectModelVersion].check({
          input,
          selector,
          latest: latestVersion
            ? {
                isComposable: latestVersion.valid,
                sdl: latestSchemaVersion?.compositeSchemaSDL ?? null,
                schemas: [ensureSingleSchema(latestVersion.schemas)],
              }
            : null,
          latestComposable: latestComposableVersion
            ? {
                isComposable: latestComposableVersion.valid,
                sdl: latestComposableSchemaVersion?.compositeSchemaSDL ?? null,
                schemas: [ensureSingleSchema(latestComposableVersion.schemas)],
              }
            : null,
          baseSchema,
          project,
          organization,
          approvedChanges: approvedSchemaChanges,
        });
        break;
      case ProjectType.FEDERATION:
      case ProjectType.STITCHING:
        this.logger.debug(
          'Using %s registry model (version=%s)',
          project.type,
          projectModelVersion,
        );

        if (!input.service) {
          throw new Error('Guard for TypeScript limitations on inferring types. :)');
        }

        checkResult = await this.models[project.type][projectModelVersion].check({
          input: {
            sdl,
            serviceName: input.service,
          },
          selector,
          latest: latestVersion
            ? {
                isComposable: latestVersion.valid,
                sdl: latestSchemaVersion?.compositeSchemaSDL ?? null,
                schemas: ensureCompositeSchemas(latestVersion.schemas),
              }
            : null,
          latestComposable: latestComposableVersion
            ? {
                isComposable: latestComposableVersion.valid,
                sdl: latestComposableSchemaVersion?.compositeSchemaSDL ?? null,
                schemas: ensureCompositeSchemas(latestComposableVersion.schemas),
              }
            : null,
          baseSchema,
          project,
          organization,
          approvedChanges: approvedSchemaChanges,
          contracts:
            contracts?.map(contract => ({
              ...contract,
              approvedChanges: approvedContractChanges?.get(contract.contract.id) ?? null,
            })) ?? null,
        });
        break;
      default:
        this.logger.debug('Unsupported project type (type=%s)', project.type);
        throw new HiveError(`${project.type} project (${projectModelVersion}) not supported`);
    }

    let schemaCheck: null | SchemaCheck = null;

    const retention = await this.rateLimit.getRetention({ targetId: target.id });
    const expiresAt = retention ? new Date(Date.now() + retention * millisecondsPerDay) : null;

    const comparedVersion =
      organization.featureFlags.compareToPreviousComposableVersion === false
        ? latestVersion
        : latestComposableVersion;
    const comparedSchemaVersion =
      organization.featureFlags.compareToPreviousComposableVersion === false
        ? latestSchemaVersion
        : latestComposableSchemaVersion;

    if (checkResult.conclusion === SchemaCheckConclusion.Failure) {
      schemaCheck = await this.storage.createSchemaCheck({
        schemaSDL: sdl,
        serviceName: input.service ?? null,
        meta: input.meta ?? null,
        targetId: target.id,
        schemaVersionId: latestVersion?.version ?? null,
        isSuccess: false,
        breakingSchemaChanges: checkResult.state.schemaChanges?.breaking ?? null,
        safeSchemaChanges: checkResult.state.schemaChanges?.safe ?? null,
        schemaPolicyWarnings: checkResult.state.schemaPolicy?.warnings ?? null,
        schemaPolicyErrors: checkResult.state.schemaPolicy?.errors ?? null,
        ...(checkResult.state.composition.errors
          ? {
              schemaCompositionErrors: checkResult.state.composition.errors,
              compositeSchemaSDL: null,
              supergraphSDL: null,
            }
          : {
              schemaCompositionErrors: null,
              compositeSchemaSDL: checkResult.state.composition.compositeSchemaSDL,
              supergraphSDL: checkResult.state.composition.supergraphSDL,
            }),
        isManuallyApproved: false,
        manualApprovalUserId: null,
        githubCheckRunId: githubCheckRun?.id ?? null,
        githubRepository: githubCheckRun
          ? githubCheckRun.owner + '/' + githubCheckRun.repository
          : null,
        githubSha: githubCheckRun?.commit ?? null,
        expiresAt,
        contextId,
        contracts:
          checkResult.state.contracts?.map(contract => ({
            contractId: contract.contractId,
            contractName: contract.contractName,
            comparedContractVersionId:
              contractVersionIdByContractName.get(contract.contractName) ?? null,
            isSuccess: contract.isSuccessful,
            compositeSchemaSdl: contract.composition.compositeSchemaSDL,
            supergraphSchemaSdl: contract.composition.supergraphSDL,
            schemaCompositionErrors: contract.composition.errors ?? null,
            breakingSchemaChanges: contract.schemaChanges?.breaking ?? null,
            safeSchemaChanges: contract.schemaChanges?.safe ?? null,
          })) ?? null,
      });
    } else if (checkResult.conclusion === SchemaCheckConclusion.Success) {
      schemaCheck = await this.storage.createSchemaCheck({
        schemaSDL: sdl,
        serviceName: input.service ?? null,
        meta: input.meta ?? null,
        targetId: target.id,
        schemaVersionId: latestVersion?.version ?? null,
        isSuccess: true,
        breakingSchemaChanges: checkResult.state?.schemaChanges?.breaking ?? null,
        safeSchemaChanges: checkResult.state?.schemaChanges?.safe ?? null,
        schemaPolicyWarnings: checkResult.state?.schemaPolicyWarnings ?? null,
        schemaPolicyErrors: null,
        schemaCompositionErrors: null,
        compositeSchemaSDL: checkResult.state.composition.compositeSchemaSDL,
        supergraphSDL: checkResult.state.composition.supergraphSDL,
        isManuallyApproved: false,
        manualApprovalUserId: null,
        githubCheckRunId: githubCheckRun?.id ?? null,
        githubRepository: githubCheckRun
          ? githubCheckRun.owner + '/' + githubCheckRun.repository
          : null,
        githubSha: githubCheckRun?.commit ?? null,
        expiresAt,
        contextId,
        contracts:
          checkResult.state?.contracts?.map(contract => ({
            contractId: contract.contractId,
            contractName: contract.contractName,
            comparedContractVersionId:
              contractVersionIdByContractName.get(contract.contractName) ?? null,
            isSuccess: contract.isSuccessful,
            compositeSchemaSdl: contract.composition.compositeSchemaSDL,
            supergraphSchemaSdl: contract.composition.supergraphSDL,
            schemaCompositionErrors: null,
            breakingSchemaChanges: contract.schemaChanges?.breaking ?? null,
            safeSchemaChanges: contract.schemaChanges?.safe ?? null,
          })) ?? null,
      });
    } else if (checkResult.conclusion === SchemaCheckConclusion.Skip) {
      if (!comparedVersion || !comparedSchemaVersion) {
        throw new Error('This cannot happen :)');
      }

      const contractVersions = await this.contracts.getContractVersionsForSchemaVersion({
        schemaVersionId: comparedSchemaVersion.id,
      });

      const [compositeSchemaSdl, supergraphSdl, compositionErrors] = await Promise.all([
        this.schemaVersionHelper.getCompositeSchemaSdl(comparedSchemaVersion),
        this.schemaVersionHelper.getSupergraphSdl(comparedSchemaVersion),
        this.schemaVersionHelper.getSchemaCompositionErrors(comparedSchemaVersion),
      ]);

      schemaCheck = await this.storage.createSchemaCheck({
        schemaSDL: sdl,
        serviceName: input.service ?? null,
        meta: input.meta ?? null,
        targetId: target.id,
        schemaVersionId: comparedVersion?.version ?? null,
        breakingSchemaChanges: null,
        safeSchemaChanges: null,
        schemaPolicyWarnings: null,
        schemaPolicyErrors: null,
        ...(compositeSchemaSdl
          ? {
              isSuccess: true,
              schemaCompositionErrors: null,
              compositeSchemaSDL: compositeSchemaSdl,
              supergraphSDL: supergraphSdl,
            }
          : {
              isSuccess: false,
              schemaCompositionErrors: assertNonNull(
                compositionErrors,
                'Composite Schema SDL, but no composition errors.',
              ),
              compositeSchemaSDL: null,
              supergraphSDL: null,
            }),
        isManuallyApproved: false,
        manualApprovalUserId: null,
        githubCheckRunId: githubCheckRun?.id ?? null,
        githubRepository: githubCheckRun
          ? githubCheckRun.owner + '/' + githubCheckRun.repository
          : null,
        githubSha: githubCheckRun?.commit ?? null,
        expiresAt,
        contextId,
        contracts: contractVersions
          ? await Promise.all(
              contractVersions?.edges.map(async edge => ({
                contractId: edge.node.contractId,
                contractName: edge.node.contractName,
                comparedContractVersionId:
                  edge.node.schemaCompositionErrors === null
                    ? edge.node.id
                    : // if this version is not composable - we need to get the previous composable version
                      await this.contracts
                        .getDiffableContractVersionForContractVersion({
                          contractVersion: edge.node,
                        })
                        .then(contractVersion => contractVersion?.id ?? null),
                isSuccess: !!edge.node.schemaCompositionErrors,
                compositeSchemaSdl: edge.node.compositeSchemaSdl,
                supergraphSchemaSdl: edge.node.supergraphSdl,
                schemaCompositionErrors: edge.node.schemaCompositionErrors,
                breakingSchemaChanges: null,
                safeSchemaChanges: null,
              })),
            )
          : null,
      });
    }

    if (githubCheckRun) {
      if (checkResult.conclusion === SchemaCheckConclusion.Success) {
        const failedContractCompositionCount =
          checkResult.state.contracts?.filter(c => !c.isSuccessful).length ?? 0;

        increaseSchemaCheckCountMetric('accepted');
        return await this.updateGithubCheckRunForSchemaCheck({
          project,
          target,
          organization,
          conclusion: checkResult.conclusion,
          changes: checkResult.state?.schemaChanges?.all ?? null,
          breakingChanges: checkResult.state?.schemaChanges?.breaking ?? null,
          warnings: checkResult.state?.schemaPolicyWarnings ?? null,
          compositionErrors: null,
          errors: null,
          schemaCheckId: schemaCheck?.id ?? null,
          githubCheckRun: githubCheckRun,
          failedContractCompositionCount,
        });
      }

      if (checkResult.conclusion === SchemaCheckConclusion.Failure) {
        const failedContractCompositionCount =
          checkResult.state.contracts?.filter(c => !c.isSuccessful).length ?? 0;

        increaseSchemaCheckCountMetric('rejected');
        return await this.updateGithubCheckRunForSchemaCheck({
          project,
          target,
          organization,
          conclusion: checkResult.conclusion,
          changes: [
            ...(checkResult.state.schemaChanges?.breaking ?? []),
            ...(checkResult.state.schemaChanges?.safe ?? []),
          ],
          breakingChanges: checkResult.state.schemaChanges?.breaking ?? [],
          compositionErrors: checkResult.state.composition.errors ?? [],
          warnings: checkResult.state.schemaPolicy?.warnings ?? [],
          errors: checkResult.state.schemaPolicy?.errors?.map(formatPolicyError) ?? [],
          schemaCheckId: schemaCheck?.id ?? null,
          githubCheckRun: githubCheckRun,
          failedContractCompositionCount,
        });
      }

      // SchemaCheckConclusion.Skip

      if (!comparedVersion || !comparedSchemaVersion) {
        throw new Error('This cannot happen :)');
      }

      if (comparedSchemaVersion.isComposable) {
        increaseSchemaCheckCountMetric('accepted');
        const contracts = await this.contracts.getContractVersionsForSchemaVersion({
          schemaVersionId: comparedSchemaVersion.id,
        });
        const failedContractCompositionCount =
          contracts?.edges.filter(edge => edge.node.schemaCompositionErrors !== null).length ?? 0;

        return await this.updateGithubCheckRunForSchemaCheck({
          project,
          target,
          organization,
          conclusion: SchemaCheckConclusion.Success,
          changes: null,
          breakingChanges: null,
          warnings: null,
          compositionErrors: null,
          errors: null,
          schemaCheckId: schemaCheck?.id ?? null,
          githubCheckRun: githubCheckRun,
          failedContractCompositionCount,
        });
      }

      increaseSchemaCheckCountMetric('rejected');
      return await this.updateGithubCheckRunForSchemaCheck({
        project,
        target,
        organization,
        conclusion: SchemaCheckConclusion.Failure,
        changes: null,
        breakingChanges: null,
        compositionErrors: comparedSchemaVersion.schemaCompositionErrors,
        warnings: null,
        errors: null,
        schemaCheckId: schemaCheck?.id ?? null,
        githubCheckRun: githubCheckRun,
        failedContractCompositionCount: 0,
      });
    }

    if (schemaCheck == null) {
      throw new Error('Invalid state. Schema check can not be null at this point.');
    }

    const schemaCheckSelector = {
      organizationId: target.orgId,
      projectId: target.projectId,
    };

    if (checkResult.conclusion === SchemaCheckConclusion.Success) {
      increaseSchemaCheckCountMetric('accepted');
      return {
        __typename: 'SchemaCheckSuccess',
        valid: true,
        changes: [
          ...(checkResult.state?.schemaChanges?.all ?? []),
          ...(checkResult.state?.contracts?.flatMap(contract => [
            ...(contract.schemaChanges?.all?.map(change => ({
              ...change,
              message: `[${contract.contractName}] ${change.message}`,
            })) ?? []),
          ]) ?? []),
        ],
        warnings: checkResult.state?.schemaPolicyWarnings ?? [],
        initial: latestVersion == null,
        schemaCheck: toGraphQLSchemaCheck(schemaCheckSelector, schemaCheck),
      } as const;
    }

    if (checkResult.conclusion === SchemaCheckConclusion.Failure) {
      increaseSchemaCheckCountMetric('rejected');

      return {
        __typename: 'SchemaCheckError',
        valid: false,
        changes: [
          ...(checkResult.state.schemaChanges?.all ?? []),
          ...(checkResult.state.contracts?.flatMap(contract => [
            ...(contract.schemaChanges?.all?.map(change => ({
              ...change,
              message: `[${contract.contractName}] ${change.message}`,
            })) ?? []),
          ]) ?? []),
        ],
        warnings: checkResult.state.schemaPolicy?.warnings ?? [],
        errors: [
          ...(checkResult.state.schemaChanges?.breaking?.filter(
            breaking => breaking.approvalMetadata == null && breaking.isSafeBasedOnUsage === false,
          ) ?? []),
          ...(checkResult.state.schemaPolicy?.errors?.map(formatPolicyError) ?? []),
          ...(checkResult.state.composition.errors ?? []),
          ...(checkResult.state.contracts?.flatMap(contract => [
            ...(contract.composition.errors?.map(error => ({
              message: `[${contract.contractName}] ${error.message}`,
              source: error.source,
            })) ?? []),
          ]) ?? []),
          ...(checkResult.state.contracts?.flatMap(contract => [
            ...(contract.schemaChanges?.breaking
              ?.filter(
                breaking =>
                  breaking.approvalMetadata == null && breaking.isSafeBasedOnUsage === false,
              )
              .map(change => ({
                ...change,
                message: `[${contract.contractName}] ${change.message}`,
              })) ?? []),
          ]) ?? []),
        ],
        schemaCheck: toGraphQLSchemaCheck(schemaCheckSelector, schemaCheck),
      } as const;
    }

    // SchemaCheckConclusion.Skip

    if (!comparedVersion || !comparedSchemaVersion) {
      throw new Error('This cannot happen :)');
    }

    if (comparedSchemaVersion.isComposable) {
      increaseSchemaCheckCountMetric('accepted');
      return {
        __typename: 'SchemaCheckSuccess',
        valid: true,
        changes: [],
        warnings: [],
        initial: false,
        schemaCheck: toGraphQLSchemaCheck(schemaCheckSelector, schemaCheck),
      } as const;
    }

    const contractVersions = await this.contracts.getContractVersionsForSchemaVersion({
      schemaVersionId: comparedSchemaVersion.id,
    });

    increaseSchemaCheckCountMetric('rejected');
    return {
      __typename: 'SchemaCheckError',
      valid: false,
      changes: [],
      warnings: [],
      errors: [
        ...(comparedSchemaVersion.schemaCompositionErrors?.map(error => ({
          message: error.message,
          source: error.source,
        })) ?? []),
        ...(contractVersions?.edges.flatMap(edge => [
          ...(edge.node.schemaCompositionErrors?.map(
            error =>
              ({
                message: `[${edge.node.contractName}] ${error.message}`,
                source: error.source,
              }) ?? [],
          ) ?? []),
        ]) ?? []),
      ],
      schemaCheck: toGraphQLSchemaCheck(schemaCheckSelector, schemaCheck),
    } as const;
  }

  @sentry('SchemaPublisher.publish')
  async publish(input: PublishInput, signal: AbortSignal): Promise<PublishResult> {
    this.logger.debug(
      'Schema publication (checksum=%s, organization=%s, project=%s, target=%s)',
      input.checksum,
      input.organization,
      input.project,
      input.target,
    );
    return this.mutex.perform(
      registryLockId(input.target),
      {
        signal,
      },
      async () => {
        await this.authManager.ensureTargetAccess({
          target: input.target,
          project: input.project,
          organization: input.organization,
          scope: TargetAccessScope.REGISTRY_WRITE,
        });
        return this.distributedCache.wrap({
          key: `schema:publish:${input.checksum}`,
          ttlSeconds: 15,
          executor: () => this.internalPublish(input),
        });
      },
    );
  }

  public async updateVersionStatus(input: TargetSelector & { version: string; valid: boolean }) {
    const updateResult = await this.schemaManager.updateSchemaVersionStatus(input);

    if (updateResult.isComposable === true) {
      // Now, when fetching the latest valid version, we should be able to detect
      // if it's the version we just updated or not.
      // Why?
      // Because we change its status to valid
      // and `getLatestValidVersion` calls for fresh data from DB
      const latestVersion = await this.schemaManager.getLatestValidVersion(input);

      // if it is the latest version, we should update the CDN
      if (latestVersion.id === updateResult.id) {
        this.logger.info('Version is now promoted to latest valid (version=%s)', latestVersion.id);
        const [organization, project, target, schemas] = await Promise.all([
          this.organizationManager.getOrganization({
            organization: input.organization,
          }),
          this.projectManager.getProject({
            organization: input.organization,
            project: input.project,
          }),
          this.targetManager.getTarget({
            organization: input.organization,
            project: input.project,
            target: input.target,
          }),
          this.schemaManager.getSchemasOfVersion({
            organization: input.organization,
            project: input.project,
            target: input.target,
            version: latestVersion.id,
            includeMetadata: true,
          }),
        ]);

        const orchestrator = this.schemaManager.matchOrchestrator(project.type);
        const schemaObjects = schemas.map(s => this.helper.createSchemaObject(s));
        const compositionResult = await orchestrator.composeAndValidate(schemaObjects, {
          external: project.externalComposition,
          native: this.schemaManager.checkProjectNativeFederationSupport({
            project,
            organization,
          }),
          contracts: null,
        });

        this.logger.info(
          'Deploying version to CDN (reason="status_change" version=%s)',
          latestVersion.id,
        );

        await this.publishToCDN({
          target,
          project,
          supergraph: compositionResult.supergraph,
          schemas,
          fullSchemaSdl: compositionResult.sdl!,
          contracts: null,
        });
      }
    }

    return updateResult;
  }

  @sentry('SchemaPublisher.delete')
  async delete(input: DeleteInput, signal: AbortSignal) {
    this.logger.info('Deleting schema (input=%o)', input);

    return this.mutex.perform(
      registryLockId(input.target.id),
      {
        signal,
      },
      async () => {
        await this.authManager.ensureTargetAccess({
          organization: input.organization,
          project: input.project,
          target: input.target.id,
          scope: TargetAccessScope.REGISTRY_WRITE,
        });
        const [
          project,
          organization,
          latestVersion,
          latestComposableVersion,
          baseSchema,
          latestSchemaVersion,
          latestComposableSchemaVersion,
        ] = await Promise.all([
          this.projectManager.getProject({
            organization: input.organization,
            project: input.project,
          }),
          this.organizationManager.getOrganization({
            organization: input.organization,
          }),
          this.schemaManager.getLatestSchemas({
            organization: input.organization,
            project: input.project,
            target: input.target.id,
          }),
          this.schemaManager.getLatestSchemas({
            organization: input.organization,
            project: input.project,
            target: input.target.id,
            onlyComposable: true,
          }),
          this.schemaManager.getBaseSchema({
            organization: input.organization,
            project: input.project,
            target: input.target.id,
          }),
          this.schemaManager.getMaybeLatestVersion({
            organization: input.organization,
            project: input.project,
            target: input.target.id,
          }),
          this.schemaManager.getMaybeLatestValidVersion({
            organization: input.organization,
            project: input.project,
            target: input.target.id,
          }),
        ]);

        const modelVersion = project.legacyRegistryModel ? 'legacy' : 'modern';

        schemaDeleteCount.inc({ model: modelVersion, projectType: project.type });

        if (project.type !== ProjectType.FEDERATION && project.type !== ProjectType.STITCHING) {
          throw new HiveError(`${project.type} project (${modelVersion}) not supported`);
        }

        if (modelVersion === 'legacy') {
          throw new HiveError(
            'Please upgrade your project to the new registry model to use this feature. See https://the-guild.dev/blog/graphql-hive-improvements-in-schema-registry',
          );
        }

        if (!latestVersion || latestVersion.schemas.length === 0) {
          throw new HiveError('Registry is empty');
        }

        const schemas = ensureCompositeSchemas(latestVersion.schemas);
        this.logger.debug(`Found ${latestVersion?.schemas.length ?? 0} most recent schemas`);
        this.logger.debug(
          'Using %s registry model (version=%s, featureFlags=%o)',
          project.type,
          modelVersion,
          organization.featureFlags,
        );

        const serviceExists = schemas.some(s => s.service_name === input.serviceName);

        if (!serviceExists) {
          return {
            __typename: 'SchemaDeleteError',
            valid: latestVersion.valid,
            errors: [
              {
                message: `Service "${input.serviceName}" not found`,
              },
            ],
          } as const;
        }

        const contracts =
          project.type === ProjectType.FEDERATION
            ? await this.contracts.loadActiveContractsWithLatestValidContractVersionsByTargetId({
                targetId: input.target.id,
              })
            : null;

        const contractIdToLatestValidContractVersionId = new Map<string, string | null>();
        for (const contract of contracts ?? []) {
          contractIdToLatestValidContractVersionId.set(
            contract.contract.id,
            contract.latestValidVersion?.id ?? null,
          );
        }

        const deleteResult = await this.models[project.type][modelVersion].delete({
          input: {
            serviceName: input.serviceName,
          },
          latest: {
            isComposable: latestVersion.valid,
            sdl: latestSchemaVersion?.compositeSchemaSDL ?? null,
            schemas,
          },
          latestComposable: latestComposableVersion
            ? {
                isComposable: latestComposableVersion.valid,
                sdl: latestComposableSchemaVersion?.compositeSchemaSDL ?? null,
                schemas: ensureCompositeSchemas(latestComposableVersion.schemas),
              }
            : null,
          baseSchema,
          project,
          organization,
          selector: {
            target: input.target.id,
            project: input.project,
            organization: input.organization,
          },
          contracts,
        });

        let diffSchemaVersionId: string | null = null;
        if (
          organization.featureFlags.compareToPreviousComposableVersion &&
          latestComposableSchemaVersion
        ) {
          diffSchemaVersionId = latestComposableSchemaVersion.id;
        }

        if (!organization.featureFlags.compareToPreviousComposableVersion && latestSchemaVersion) {
          diffSchemaVersionId = latestSchemaVersion.id;
        }

        if (deleteResult.conclusion === SchemaDeleteConclusion.Accept) {
          this.logger.debug('Delete accepted');
          if (input.dryRun !== true) {
            const schemaVersion = await this.storage.deleteSchema({
              organization: input.organization,
              project: input.project,
              target: input.target.id,
              serviceName: input.serviceName,
              composable: deleteResult.state.composable,
              diffSchemaVersionId,
              changes: deleteResult.state.changes,
              contracts:
                deleteResult.state.contracts?.map(contract => ({
                  contractId: contract.contractId,
                  contractName: contract.contractName,
                  compositeSchemaSDL: contract.fullSchemaSdl,
                  supergraphSDL: contract.supergraph,
                  schemaCompositionErrors: contract.compositionErrors,
                  changes: contract.changes,
                })) ?? null,
              ...(deleteResult.state.fullSchemaSdl
                ? {
                    compositeSchemaSDL: deleteResult.state.fullSchemaSdl,
                    supergraphSDL: deleteResult.state.supergraph,
                    schemaCompositionErrors: null,
                    tags: deleteResult.state.tags,
                  }
                : {
                    compositeSchemaSDL: null,
                    supergraphSDL: null,
                    schemaCompositionErrors: deleteResult.state.compositionErrors ?? [],
                    tags: null,
                  }),
              actionFn: async () => {
                if (deleteResult.state.composable) {
                  const contracts: Array<{ name: string; sdl: string; supergraph: string }> = [];
                  for (const contract of deleteResult.state.contracts ?? []) {
                    if (contract.fullSchemaSdl && contract.supergraph) {
                      contracts.push({
                        name: contract.contractName,
                        sdl: contract.fullSchemaSdl,
                        supergraph: contract.supergraph,
                      });
                    }
                  }

                  await this.publishToCDN({
                    target: input.target,
                    project,
                    supergraph: deleteResult.state.supergraph,
                    fullSchemaSdl: deleteResult.state.fullSchemaSdl,
                    // pass all schemas except the one we are deleting
                    schemas: schemas.filter(s => s.service_name !== input.serviceName),
                    contracts,
                  });
                }
              },
            });

            const changes = deleteResult.state.changes ?? [];
            const errors = [
              ...(deleteResult.state.compositionErrors ?? []),
              ...(deleteResult.state.breakingChanges ?? []).map(change => ({
                message: change.message,
                // triggerSchemaChangeNotifications.errors accepts only path as array
                path: change.path ? [change.path] : undefined,
              })),
            ];

            if ((Array.isArray(changes) && changes.length > 0) || errors.length > 0) {
              void this.alertsManager
                .triggerSchemaChangeNotifications({
                  organization,
                  project,
                  target: input.target,
                  schema: {
                    id: schemaVersion.versionId,
                    commit: schemaVersion.id,
                    valid: deleteResult.state.composable,
                  },
                  changes,
                  messages: [],
                  errors,
                  initial: false,
                })
                .catch(err => {
                  this.logger.error('Failed to trigger schema change notifications', err);
                });
            }
          }

          return {
            __typename: 'SchemaDeleteSuccess',
            valid: deleteResult.state.composable,
            changes: deleteResult.state.changes,
            errors: [
              ...(deleteResult.state.compositionErrors ?? []),
              ...(deleteResult.state.breakingChanges ?? []),
            ],
          } as const;
        }

        this.logger.debug('Delete rejected');

        const errors = [];

        const compositionErrors = getReasonByCode(
          deleteResult.reasons,
          DeleteFailureReasonCode.CompositionFailure,
        )?.compositionErrors;

        if (getReasonByCode(deleteResult.reasons, DeleteFailureReasonCode.MissingServiceName)) {
          errors.push({
            message: 'Service name is required',
          });
        }

        if (compositionErrors?.length) {
          errors.push(...compositionErrors);
        }

        return {
          __typename: 'SchemaDeleteError',
          valid: false,
          errors,
        } as const;
      },
    );
  }

  private async internalPublish(input: PublishInput) {
    const [organizationId, projectId, targetId] = [input.organization, input.project, input.target];
    this.logger.info('Publishing schema (input=%o)', {
      ...lodash.omit(input, ['sdl', 'organization', 'project', 'target', 'metadata']),
      organization: organizationId,
      project: projectId,
      target: targetId,
      sdl: input.sdl.length,
      checksum: input.checksum,
      experimental_accept_breaking_changes: input.experimental_acceptBreakingChanges === true,
      metadata: !!input.metadata,
    });

    const [
      organization,
      project,
      target,
      latestVersion,
      latestComposable,
      baseSchema,
      latestSchemaVersion,
      latestComposableSchemaVersion,
    ] = await Promise.all([
      this.organizationManager.getOrganization({
        organization: organizationId,
      }),
      this.projectManager.getProject({
        organization: organizationId,
        project: projectId,
      }),
      this.targetManager.getTarget({
        organization: organizationId,
        project: projectId,
        target: targetId,
      }),
      this.schemaManager.getLatestSchemas({
        organization: organizationId,
        project: projectId,
        target: targetId,
      }),
      this.schemaManager.getLatestSchemas({
        organization: organizationId,
        project: projectId,
        target: targetId,
        onlyComposable: true,
      }),
      this.schemaManager.getBaseSchema({
        organization: organizationId,
        project: projectId,
        target: targetId,
      }),
      this.schemaManager.getMaybeLatestVersion({
        organization: input.organization,
        project: input.project,
        target: input.target,
      }),
      this.schemaManager.getMaybeLatestValidVersion({
        organization: input.organization,
        project: input.project,
        target: input.target,
      }),
    ]);

    const modelVersion = project.legacyRegistryModel ? 'legacy' : 'modern';

    function increaseSchemaPublishCountMetric(conclusion: 'rejected' | 'accepted' | 'ignored') {
      schemaPublishCount.inc({
        model: modelVersion,
        projectType: project.type,
        conclusion,
      });
    }

    let github: null | {
      repository: `${string}/${string}`;
      sha: string;
    } = null;

    if (input.gitHub != null) {
      if (!isGitHubRepositoryString(input.gitHub.repository)) {
        this.logger.debug(
          'Invalid github repository name provided (repository=%s)',
          input.gitHub.repository,
        );
        increaseSchemaPublishCountMetric('rejected');
        return {
          __typename: 'GitHubSchemaPublishError' as const,
          message: 'Invalid github repository name provided.',
        } as const;
      }

      github = {
        repository: input.gitHub.repository,
        sha: input.gitHub.commit,
      };
    } else if (input.github === true) {
      if (!project.gitRepository) {
        this.logger.debug(
          'Git repository is not configured for this project (project=%s)',
          project.id,
        );
        increaseSchemaPublishCountMetric('rejected');
        return {
          __typename: 'GitHubSchemaPublishError',
          message: 'Git repository is not configured for this project.',
        } as const;
      }
      github = {
        repository: project.gitRepository,
        sha: input.commit,
      };
    }

    let githubCheckRun: GitHubCheckRun | null = null;

    if (github) {
      const result = await this.createGithubCheckRunForSchemaPublish({
        organizationId: organization.id,
        github: {
          owner: github.repository.split('/')[0],
          repository: github.repository.split('/')[1],
          sha: github.sha,
        },
      });

      if (result.success === false) {
        increaseSchemaPublishCountMetric('rejected');
        return {
          __typename: 'GitHubSchemaPublishError',
          message: result.error,
        } as const;
      }

      githubCheckRun = result.data;
    }

    await this.schemaManager.completeGetStartedCheck({
      organization: project.orgId,
      step: 'publishingSchema',
    });

    this.logger.debug(`Found ${latestVersion?.schemas.length ?? 0} most recent schemas`);

    const contracts =
      project.type === ProjectType.FEDERATION
        ? await this.contracts.loadActiveContractsWithLatestValidContractVersionsByTargetId({
            targetId: target.id,
          })
        : null;

    const contractIdToLatestValidContractVersionId = new Map<string, string | null>();
    for (const contract of contracts ?? []) {
      contractIdToLatestValidContractVersionId.set(
        contract.contract.id,
        contract.latestValidVersion?.id ?? null,
      );
    }

    let publishResult: SchemaPublishResult;

    switch (project.type) {
      case ProjectType.SINGLE:
        this.logger.debug(
          'Using SINGLE registry model (version=%s, featureFlags=%o)',
          modelVersion,
          organization.featureFlags,
        );
        publishResult = await this.models[ProjectType.SINGLE][modelVersion].publish({
          input,
          latest: latestVersion
            ? {
                isComposable: latestVersion.valid,
                sdl: latestSchemaVersion?.compositeSchemaSDL ?? null,
                schemas: [ensureSingleSchema(latestVersion.schemas)],
              }
            : null,
          latestComposable: latestComposable
            ? {
                isComposable: latestComposable.valid,
                sdl: latestComposableSchemaVersion?.compositeSchemaSDL ?? null,
                schemas: [ensureSingleSchema(latestComposable.schemas)],
              }
            : null,
          organization,
          project,
          target,
          baseSchema,
        });
        break;
      case ProjectType.FEDERATION:
      case ProjectType.STITCHING:
        this.logger.debug(
          'Using %s registry model (version=%s, featureFlags=%o)',
          project.type,
          modelVersion,
          organization.featureFlags,
        );
        publishResult = await this.models[project.type][modelVersion].publish({
          input,
          latest: latestVersion
            ? {
                isComposable: latestVersion.valid,
                sdl: latestSchemaVersion?.compositeSchemaSDL ?? null,
                schemas: ensureCompositeSchemas(latestVersion.schemas),
              }
            : null,
          latestComposable: latestComposable
            ? {
                isComposable: latestComposable.valid,
                sdl: latestComposableSchemaVersion?.compositeSchemaSDL ?? null,
                schemas: ensureCompositeSchemas(latestComposable.schemas),
              }
            : null,
          organization,
          project,
          target,
          baseSchema,
          contracts,
        });
        break;
      default: {
        this.logger.debug('Unsupported project type (type=%s)', project.type);
        throw new HiveError(`${project.type} project (${modelVersion}) not supported`);
      }
    }

    if (publishResult.conclusion === SchemaPublishConclusion.Ignore) {
      this.logger.debug('Publish ignored (reasons=%s)', publishResult.reason);

      increaseSchemaPublishCountMetric('ignored');

      const linkToWebsite =
        typeof this.schemaModuleConfig.schemaPublishLink === 'function'
          ? this.schemaModuleConfig.schemaPublishLink({
              organization: {
                cleanId: organization.cleanId,
              },
              project: {
                cleanId: project.cleanId,
              },
              target: {
                cleanId: target.cleanId,
              },
              version: latestVersion ? { id: latestVersion.version } : undefined,
            })
          : null;

      if (githubCheckRun) {
        return this.updateGithubCheckRunForSchemaPublish({
          githubCheckRun,
          force: false,
          initial: false,
          valid: true,
          changes: [],
          errors: [],

          organizationId: organization.id,
          detailsUrl: linkToWebsite,
        });
      }

      return {
        __typename: 'SchemaPublishSuccess',
        initial: false,
        valid: true,
        changes: [],
        linkToWebsite,
      } as const;
    }

    if (publishResult.conclusion === SchemaPublishConclusion.Reject) {
      this.logger.debug(
        'Publish rejected (reasons=%s)',
        publishResult.reasons.map(r => r.code).join(', '),
      );

      increaseSchemaPublishCountMetric('rejected');

      if (getReasonByCode(publishResult.reasons, PublishFailureReasonCode.MissingServiceName)) {
        return {
          __typename: 'SchemaPublishMissingServiceError' as const,
          message: 'Missing service name',
        } as const;
      }

      if (getReasonByCode(publishResult.reasons, PublishFailureReasonCode.MissingServiceUrl)) {
        return {
          __typename: 'SchemaPublishMissingUrlError' as const,
          message: 'Missing service url',
        } as const;
      }

      const changes =
        getReasonByCode(publishResult.reasons, PublishFailureReasonCode.BreakingChanges)?.changes ??
        [];
      const errors = (
        [] as Array<{
          message: string;
        }>
      ).concat(
        getReasonByCode(publishResult.reasons, PublishFailureReasonCode.BreakingChanges)?.changes ??
          [],
        getReasonByCode(publishResult.reasons, PublishFailureReasonCode.CompositionFailure)
          ?.compositionErrors ?? [],
        getReasonByCode(publishResult.reasons, PublishFailureReasonCode.MetadataParsingFailure)
          ? [
              {
                message: 'Failed to parse metadata',
              },
            ]
          : [],
      );

      if (githubCheckRun) {
        return this.updateGithubCheckRunForSchemaPublish({
          githubCheckRun,
          force: false,
          initial: false,
          valid: false,
          changes,
          errors,
          organizationId: organization.id,
          detailsUrl: null,
        });
      }

      return {
        __typename: 'SchemaPublishError' as const,
        valid: false,
        changes,
        errors,
      };
    }

    const errors = (
      [] as Array<{
        message: string;
      }>
    ).concat(
      publishResult.state.compositionErrors ?? [],
      publishResult.state.breakingChanges ?? [],
    );

    this.logger.debug('Publishing new version');

    const composable = publishResult.state.composable;
    const fullSchemaSdl = publishResult.state.fullSchemaSdl;
    const publishState = publishResult.state;

    if (composable && !fullSchemaSdl) {
      throw new Error('Version is composable but the full schema SDL is missing');
    }

    increaseSchemaPublishCountMetric('accepted');

    const changes = publishResult.state.changes ?? [];
    const messages = publishResult.state.messages ?? [];
    const initial = publishResult.state.initial;
    const pushedSchema = publishResult.state.schema;
    const schemas = [...publishResult.state.schemas];
    const schemaLogIds = schemas
      .filter(s => s.id !== pushedSchema.id) // do not include the incoming schema
      .map(s => s.id);

    const supergraph = publishResult.state.supergraph ?? null;

    let diffSchemaVersionId: string | null = null;
    if (
      organization.featureFlags.compareToPreviousComposableVersion &&
      latestComposableSchemaVersion
    ) {
      diffSchemaVersionId = latestComposableSchemaVersion.id;
    }

    if (!organization.featureFlags.compareToPreviousComposableVersion && latestSchemaVersion) {
      diffSchemaVersionId = latestSchemaVersion.id;
    }

    this.logger.debug(`Assigning ${schemaLogIds.length} schemas to new version`);

    const schemaVersion = await this.schemaManager.createVersion({
      valid: composable,
      organization: organizationId,
      project: project.id,
      target: target.id,
      commit: input.commit,
      logIds: schemaLogIds,
      service: input.service,
      schema: input.sdl,
      author: input.author,
      url: input.url,
      base_schema: baseSchema,
      metadata: input.metadata ?? null,
      projectType: project.type,
      github,
      actionFn: async () => {
        if (composable && fullSchemaSdl) {
          const contracts: Array<{ name: string; sdl: string; supergraph: string }> = [];
          for (const contract of publishState.contracts ?? []) {
            if (contract.fullSchemaSdl && contract.supergraph) {
              contracts.push({
                name: contract.contractName,
                sdl: contract.fullSchemaSdl,
                supergraph: contract.supergraph,
              });
            }
          }

          await this.publishToCDN({
            target,
            project,
            supergraph,
            fullSchemaSdl,
            schemas,
            contracts,
          });
        }
      },
      changes,
      diffSchemaVersionId,
      previousSchemaVersion: latestVersion?.version ?? null,
      contracts:
        publishResult.state.contracts?.map(contract => ({
          contractId: contract.contractId,
          contractName: contract.contractName,
          compositeSchemaSDL: contract.fullSchemaSdl,
          supergraphSDL: contract.supergraph,
          schemaCompositionErrors: contract.compositionErrors,
          changes: contract.changes,
        })) ?? null,
      ...(fullSchemaSdl
        ? {
            compositeSchemaSDL: fullSchemaSdl,
            supergraphSDL: supergraph,
            schemaCompositionErrors: null,
            tags: publishResult.state?.tags ?? null,
          }
        : {
            compositeSchemaSDL: null,
            supergraphSDL: null,
            schemaCompositionErrors: assertNonNull(
              publishResult.state.compositionErrors,
              "Can't be null",
            ),
            tags: null,
          }),
    });

    if (changes.length > 0 || errors.length > 0) {
      void this.alertsManager
        .triggerSchemaChangeNotifications({
          organization,
          project,
          target,
          schema: {
            id: schemaVersion.id,
            commit: schemaVersion.actionId,
            valid: schemaVersion.isComposable,
          },
          changes,
          messages,
          errors,
          initial,
        })
        .catch(err => {
          this.logger.error('Failed to trigger schema change notifications', err);
        });
    }

    const linkToWebsite =
      typeof this.schemaModuleConfig.schemaPublishLink === 'function'
        ? this.schemaModuleConfig.schemaPublishLink({
            organization: {
              cleanId: organization.cleanId,
            },
            project: {
              cleanId: project.cleanId,
            },
            target: {
              cleanId: target.cleanId,
            },
            version: latestVersion
              ? {
                  id: schemaVersion.id,
                }
              : undefined,
          })
        : null;

    if (githubCheckRun) {
      return this.updateGithubCheckRunForSchemaPublish({
        githubCheckRun,
        force: false,
        initial: publishResult.state.initial,
        valid: publishResult.state.composable,
        changes: publishResult.state.changes ?? [],
        errors,
        messages: publishResult.state.messages ?? [],
        organizationId: organization.id,
        detailsUrl: linkToWebsite,
      });
    }

    return {
      __typename: 'SchemaPublishSuccess' as const,
      initial: publishResult.state.initial,
      valid: publishResult.state.composable,
      changes: modelVersion === 'legacy' ? publishResult.state.changes ?? [] : null,
      message: (publishResult.state.messages ?? []).join('\n'),
      linkToWebsite,
    };
  }

  /**
   * Returns `null` in case the check-run could not be created, which most likely indicates
   * missing permission for the GitHub App to access the GitHub repository.
   */
  private async createGithubCheckRunStartForSchemaCheck(args: {
    project: {
      orgId: string;
      cleanId: string;
      name: string;
      useProjectNameInGithubCheck: boolean;
    };
    target: Target;
    organization: Organization;
    serviceName: string | null;
    github: {
      owner: string;
      repository: string;
      sha: string;
    };
  }) {
    return await this.gitHubIntegrationManager.createCheckRun({
      name: buildGitHubActionCheckName({
        projectName: args.project.name,
        targetName: args.target.name,
        serviceName: args.serviceName,
        includeProjectName: args.project.useProjectNameInGithubCheck,
      }),
      sha: args.github.sha,
      organization: args.project.orgId,
      repositoryOwner: args.github.owner,
      repositoryName: args.github.repository,
      output: {
        title: 'Started schema check',
        summary: 'The schema check is on progress. Please wait until the result is reported.',
      },
      detailsUrl: null,
    });
  }

  private async updateGithubCheckRunForSchemaCheck({
    conclusion,
    changes,
    breakingChanges,
    compositionErrors,
    errors,
    warnings,
    schemaCheckId,
    ...args
  }: {
    organization: Organization;
    project: {
      orgId: string;
      cleanId: string;
      name: string;
      useProjectNameInGithubCheck: boolean;
    };
    target: Target;
    githubCheckRun: {
      owner: string;
      repository: string;
      id: number;
    };
    conclusion: SchemaCheckConclusion;
    warnings: SchemaCheckWarning[] | null;
    changes: Array<SchemaChangeType> | null;
    breakingChanges: Array<SchemaChangeType> | null;
    compositionErrors: Array<{
      message: string;
    }> | null;
    errors: Array<{
      message: string;
    }> | null;
    schemaCheckId: string | null;
    failedContractCompositionCount: number;
  }) {
    try {
      let title: string;
      let summary: string;

      if (conclusion === SchemaCheckConclusion.Success) {
        if (!changes || changes.length === 0) {
          title = 'No changes';
          summary = 'No changes detected';
        } else {
          title = 'No breaking changes';
          summary = this.changesToMarkdown(changes);
        }
      } else {
        const total =
          (compositionErrors?.length ?? 0) + (breakingChanges?.length ?? 0) + (errors?.length ?? 0);

        title = `Detected ${total} error${total === 1 ? '' : 's'}`;
        summary = [
          errors ? this.errorsToMarkdown(errors) : null,
          args.failedContractCompositionCount > 0
            ? `- ${args.failedContractCompositionCount} contract check(s) failed. (Click view more details on GraphQL Hive button below)`
            : null,
          warnings ? this.warningsToMarkdown(warnings) : null,
          compositionErrors ? this.errorsToMarkdown(compositionErrors) : null,
          breakingChanges ? this.errorsToMarkdown(breakingChanges) : null,
          changes ? this.changesToMarkdown(changes) : null,
        ]
          .filter(Boolean)
          .join('\n\n');
      }

      const checkRun = await this.gitHubIntegrationManager.updateCheckRun({
        organizationId: args.project.orgId,
        conclusion: conclusion === SchemaCheckConclusion.Success ? 'success' : 'failure',
        githubCheckRun: args.githubCheckRun,
        output: {
          title,
          summary: summary.length > 60_000 ? summary.slice(0, 60_000) + '...' : summary,
        },
        detailsUrl:
          (schemaCheckId &&
            this.schemaModuleConfig.schemaCheckLink?.({
              project: args.project,
              target: args.target,
              organization: args.organization,
              schemaCheckId,
            })) ||
          null,
      });

      return {
        __typename: 'GitHubSchemaCheckSuccess' as const,
        message: 'Check-run created',
        checkRun,
      };
    } catch (error: any) {
      Sentry.captureException(error);
      return {
        __typename: 'GitHubSchemaCheckError' as const,
        message: `Failed to create the check-run`,
      };
    }
  }

  @sentry('SchemaPublisher.publishToCDN')
  private async publishToCDN({
    target,
    project,
    supergraph,
    fullSchemaSdl,
    schemas,
    contracts,
  }: {
    target: Target;
    project: Project;
    supergraph: string | null;
    fullSchemaSdl: string;
    schemas: readonly Schema[];
    contracts: null | Array<{ name: string; supergraph: string; sdl: string }>;
  }) {
    const publishMetadata = async () => {
      const metadata: Array<Record<string, any>> = [];
      for (const schema of schemas) {
        if (typeof schema.metadata === 'string') {
          metadata.push(JSON.parse(schema.metadata));
        }
      }

      if (metadata.length > 0) {
        await this.artifactStorageWriter.writeArtifact({
          targetId: target.id,
          // SINGLE project can have only one metadata, we need to pass it as an object,
          // COMPOSITE projects can have multiple metadata, we need to pass it as an array
          artifact: project.type === ProjectType.SINGLE ? metadata[0] : metadata,
          artifactType: 'metadata',
          contractName: null,
        });
      }
    };

    const publishCompositeSchema = async () => {
      const compositeSchema = ensureCompositeSchemas(schemas);

      await Promise.all([
        await this.artifactStorageWriter.writeArtifact({
          targetId: target.id,
          artifactType: 'services',
          artifact: compositeSchema.map(s => ({
            name: s.service_name,
            sdl: s.sdl,
            url: s.service_url,
          })),
          contractName: null,
        }),
        this.artifactStorageWriter.writeArtifact({
          targetId: target.id,
          artifactType: 'sdl',
          artifact: fullSchemaSdl,
          contractName: null,
        }),
      ]);
    };

    const publishSingleSchema = async () => {
      await this.artifactStorageWriter.writeArtifact({
        targetId: target.id,
        artifactType: 'sdl',
        artifact: fullSchemaSdl,
        contractName: null,
      });
    };

    const actions = [
      project.type === ProjectType.SINGLE ? publishSingleSchema() : publishCompositeSchema(),
      publishMetadata(),
    ];

    if (project.type === ProjectType.FEDERATION) {
      if (supergraph) {
        this.logger.debug('Publishing supergraph to CDN');

        actions.push(
          this.artifactStorageWriter.writeArtifact({
            targetId: target.id,
            artifactType: 'supergraph',
            artifact: supergraph,
            contractName: null,
          }),
        );
      }
      if (contracts) {
        this.logger.debug('Publishing contracts to CDN');

        for (const contract of contracts) {
          this.logger.debug('Publishing contract to CDN (contractName=%s)', contract.name);
          actions.push(
            this.artifactStorageWriter.writeArtifact({
              targetId: target.id,
              artifactType: 'sdl',
              artifact: contract.sdl,
              contractName: contract.name,
            }),
            this.artifactStorageWriter.writeArtifact({
              targetId: target.id,
              artifactType: 'supergraph',
              artifact: contract.supergraph,
              contractName: contract.name,
            }),
          );
        }
      }
    }

    await Promise.all(actions);
  }

  private async createGithubCheckRunForSchemaPublish(args: {
    organizationId: string;
    github: {
      owner: string;
      repository: string;
      sha: string;
    };
  }) {
    return await this.gitHubIntegrationManager.createCheckRun({
      name: 'GraphQL Hive - schema:publish',
      sha: args.github.sha,
      organization: args.organizationId,
      repositoryOwner: args.github.owner,
      repositoryName: args.github.repository,
      output: {
        title: 'Started schema check',
        summary: 'The schema check is on progress. Please wait until the result is reported.',
      },
      detailsUrl: null,
    });
  }

  private async updateGithubCheckRunForSchemaPublish({
    initial,
    force,
    valid,
    changes,
    errors,
    messages,
    organizationId,
    githubCheckRun,
    detailsUrl,
  }: {
    organizationId: string;
    githubCheckRun: {
      owner: string;
      repository: string;
      id: number;
    };
    initial: boolean;
    force?: boolean | null;
    valid: boolean;
    changes: Array<SchemaChangeType>;
    errors: readonly Types.SchemaError[];
    messages?: string[];
    detailsUrl: string | null;
  }) {
    try {
      let title: string;
      let summary: string;

      if (valid) {
        if (initial) {
          title = 'Schema published';
          summary = 'Initial Schema published';
        } else if (changes.length === 0) {
          title = 'No changes';
          summary = 'No changes detected';
        } else {
          title = 'No breaking changes';
          summary = this.changesToMarkdown(changes);
        }
      } else {
        title = `Detected ${errors.length} error${errors.length === 1 ? '' : 's'}`;
        summary = [
          errors ? this.errorsToMarkdown(errors) : null,
          changes ? this.changesToMarkdown(changes) : null,
        ]
          .filter(Boolean)
          .join('\n\n');
      }

      if (messages?.length) {
        summary += `\n\n${messages.map(val => `- ${val}`).join('\n')}`;
      }

      if (valid === false && force === true) {
        title += ' (forced)';
      }

      await this.gitHubIntegrationManager.updateCheckRun({
        githubCheckRun,
        conclusion: valid ? 'success' : force ? 'neutral' : 'failure',
        organizationId,
        output: {
          title,
          summary,
        },
        detailsUrl,
      });
      return {
        __typename: 'GitHubSchemaPublishSuccess',
        message: title,
      } as const;
    } catch (error: unknown) {
      Sentry.captureException(error);
      return {
        __typename: 'GitHubSchemaPublishError',
        message: `Failed to create the check-run`,
      } as const;
    }
  }

  private errorsToMarkdown(errors: ReadonlyArray<{ message: string }>): string {
    return ['', ...errors.map(error => `- ${bolderize(error.message)}`)].join('\n');
  }

  private warningsToMarkdown(warnings: SchemaCheckWarning[]): string {
    return [
      '',
      ...warnings.map(warning => {
        const details = [warning.source ? `source: ${warning.source}` : undefined]
          .filter(Boolean)
          .join(', ');

        return `- ${bolderize(warning.message)}${details ? ` (${details})` : ''}`;
      }),
    ].join('\n');
  }

  private changesToMarkdown(changes: ReadonlyArray<SchemaChangeType>): string {
    const breakingChanges = changes.filter(filterChangesByLevel(CriticalityLevel.Breaking));
    const dangerousChanges = changes.filter(filterChangesByLevel(CriticalityLevel.Dangerous));
    const safeChanges = changes.filter(filterChangesByLevel(CriticalityLevel.NonBreaking));

    const lines: string[] = [
      `## Found ${changes.length} change${changes.length > 1 ? 's' : ''}`,
      '',
    ];

    if (breakingChanges.length) {
      lines.push(`Breaking: ${breakingChanges.length}`);
    }

    if (dangerousChanges.length) {
      lines.push(`Dangerous: ${dangerousChanges.length}`);
    }

    if (safeChanges.length) {
      lines.push(`Safe: ${safeChanges.length}`);
    }

    writeChanges('Breaking', breakingChanges, lines);
    writeChanges('Dangerous', dangerousChanges, lines);
    writeChanges('Safe', safeChanges, lines);

    return lines.join('\n');
  }
}

function filterChangesByLevel(level: CriticalityLevel) {
  return (change: SchemaChangeType) => change.criticality === level;
}

function writeChanges(
  type: string,
  changes: ReadonlyArray<{ message: string }>,
  lines: string[],
): void {
  if (changes.length > 0) {
    lines.push(
      ...['', `### ${type} changes`].concat(
        changes.map(change => ` - ${bolderize(change.message)}`),
      ),
    );
  }
}

function buildGitHubActionCheckName(input: {
  targetName: string;
  projectName: string;
  serviceName: string | null;
  includeProjectName: boolean;
}) {
  const path = [
    input.includeProjectName ? input.projectName : null,
    input.targetName,
    input.serviceName,
  ].filter((val): val is string => typeof val === 'string');

  return `GraphQL Hive > schema:check > ${path.join(' > ')}`;
}

function tryPrettifySDL(sdl: string): string {
  try {
    return print(parse(sdl));
  } catch {
    return sdl;
  }
}

const millisecondsPerDay = 60 * 60 * 24 * 1000;

const SchemaCheckContextIdModel = z
  .string()
  .min(1, {
    message: 'Context ID must be at least 1 character long.',
  })
  .max(200, {
    message: 'Context ID cannot exceed length of 200 characters.',
  });
