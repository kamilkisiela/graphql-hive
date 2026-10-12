import { createHash } from 'node:crypto';
import type {
  FailedSchemaCheckMapper,
  SuccessfulSchemaCheckMapper,
} from '../module.graphql.mappers';
import stringify from 'fast-json-stable-stringify';
import { GraphQLError, parse, print } from 'graphql';
import { Inject, Injectable, Scope } from 'graphql-modules';
import lodash from 'lodash';
import promClient from 'prom-client';
import { z } from 'zod';
import { CriticalityLevel } from '@graphql-inspector/core';
import { fail, invariant, trace, traceFn } from '@hive/service-common';
import type {
  ConditionalBreakingChangeMetadata,
  SchemaChangeType,
  SchemaCheck,
} from '@hive/storage';
import * as Sentry from '@sentry/node';
import * as Types from '../../../__generated__/types';
import { Organization, Project, ProjectType, Schema, Target } from '../../../shared/entities';
import { HiveError } from '../../../shared/errors';
import { createPeriod } from '../../../shared/helpers';
import { isGitHubRepositoryString } from '../../../shared/is-github-repository-string';
import { bolderize } from '../../../shared/markdown';
import { AlertsManager } from '../../alerts/providers/alerts-manager';
import { AppDeployments } from '../../app-deployments/providers/app-deployments';
import { Session } from '../../auth/lib/authz';
import { RateLimitProvider } from '../../commerce/providers/rate-limit.provider';
import { GraphStore, type Graph } from '../../graph/providers/graph-store';
import {
  GitHubIntegrationManager,
  isGitHubClientError,
  type GitHubCheckRun,
} from '../../integrations/providers/github-integration-manager';
import { OperationsReader } from '../../operations/providers/operations-reader';
import { ProjectStore } from '../../project/providers/project-store';
import { SchemaProposalStorage } from '../../proposals/providers/schema-proposal-storage';
import { DistributedCache } from '../../shared/providers/distributed-cache';
import { IdTranslator } from '../../shared/providers/id-translator';
import { Logger } from '../../shared/providers/logger';
import { Mutex, MutexResourceLockedError } from '../../shared/providers/mutex';
import {
  registryOperationOutcomeCount,
  registryOperationUnexpectedErrorCount,
  unexpectedErrorMetricLabels,
} from '../../shared/providers/registry-operation-metrics';
import { Storage, type TargetSelector } from '../../shared/providers/storage';
import { TargetManager } from '../../target/providers/target-manager';
import { TargetStore } from '../../target/providers/target-store';
import { toGraphQLSchemaCheck } from '../to-graphql-schema-check';
import { ArtifactStorageWriter } from './artifact-storage-writer';
import type { SchemaModuleConfig } from './config';
import { SCHEMA_MODULE_CONFIG } from './config';
import { Contracts, type ContractWithLatestVersions } from './contracts';
import { CompositeModel } from './models/composite';
import {
  ContractResult,
  DeleteFailureReasonCode,
  formatPolicyError,
  getReasonByCode,
  PublishFailureReasonCode,
  SchemaCheckConclusion,
  SchemaCheckFailureReason,
  SchemaDeleteConclusion,
  SchemaPublishConclusion,
  type SchemaCheckResult,
  type SchemaCheckWarning,
  type SchemaPublishResult,
} from './models/shared';
import { SingleModel } from './models/single';
import { RegistryChecks, type ConditionalBreakingChangeDiffConfig } from './registry-checks';
import {
  ensureCompositeSchemas,
  ensureSingleSchema,
  toCompositeSchemaInput,
  toSingleSchemaInput,
  type SchemaInput,
} from './schema-helper';
import { SchemaManager } from './schema-manager';
import { SchemaRevisionStore, SchemaRevisionUnavailableError } from './schema-revision-store';
import { SchemaVersionHelper } from './schema-version-helper';
import {
  SchemaVersionStore,
  type CreateContractVersionInput,
  type SchemaLogDiffInput,
  type SchemaLogWithEdges,
  type SchemaVersion,
  type SchemaVersionMeta,
} from './schema-version-store';

const schemaCheckCount = new promClient.Counter({
  name: 'registry_check_count',
  help: 'Number of schema checks',
  labelNames: ['model', 'projectType', 'conclusion'],
});

const schemaPublishCount = new promClient.Counter({
  name: 'registry_publish_count',
  help: 'Number of performed schema publishes',
  labelNames: ['model', 'projectType', 'conclusion'],
});

const schemaDeleteCount = new promClient.Counter({
  name: 'registry_delete_count',
  help: 'Number of schema deletes',
  labelNames: ['model', 'projectType'],
});

export type CheckInput = Types.SchemaCheckInput & {
  schemaProposalId?: string | null;
};

export type DeleteInput = Types.SchemaDeleteInput;

export type PublishInput = Types.SchemaPublishInput & {
  isSchemaPublishMissingUrlErrorSelected: boolean;
};

type ResolvedPublishInput = Omit<PublishInput, 'sdl' | 'schema'> & {
  sdl: string;
  schemaRevisionId: string | null;
  revision: string | null;
};

type BreakPromise<T> = T extends Promise<infer U> ? U : never;

type PublishResult =
  | BreakPromise<ReturnType<SchemaPublisher['internalPublish']>>
  | {
      readonly __typename: 'SchemaPublishMissingServiceError';
      message: 'Missing service name';
    }
  | {
      readonly __typename: 'SchemaPublishRetry';
      readonly reason: string;
    };

function revisionNotFoundResult(revision: string) {
  return {
    __typename: 'SchemaPublishError' as const,
    valid: false,
    changes: [],
    errors: [{ message: `Schema revision '${revision}' was not found.` }],
  };
}

function registryLockId(targetId: string) {
  return `registry-lock:${targetId}`;
}

function assertNonNull<T>(value: T | null, message: string): T {
  if (value === null) {
    throw new Error(message);
  }
  return value;
}

type ConditionalBreakingChangeConfiguration = {
  conditionalBreakingChangeDiffConfig: ConditionalBreakingChangeDiffConfig;
  retentionInDays: number;
  percentage: number;
  requestCount: number;
  breakingChangeFormula: 'PERCENTAGE' | 'REQUEST_COUNT';
  totalRequestCount: number;
};

@Injectable({
  scope: Scope.Operation,
})
export class SchemaPublisher {
  private logger: Logger;
  private models: {
    [ProjectType.SINGLE]: SingleModel;
    [ProjectType.FEDERATION]: CompositeModel;
    [ProjectType.STITCHING]: CompositeModel;
  };

  constructor(
    logger: Logger,
    private session: Session,
    private storage: Storage,
    private projectStore: ProjectStore,
    private targetStore: TargetStore,
    private schemaManager: SchemaManager,
    private targetManager: TargetManager,
    private alertsManager: AlertsManager,
    private schemaProposals: SchemaProposalStorage,
    private gitHubIntegrationManager: GitHubIntegrationManager,
    private distributedCache: DistributedCache,
    private artifactStorageWriter: ArtifactStorageWriter,
    private mutex: Mutex,
    private rateLimit: RateLimitProvider,
    private contracts: Contracts,
    private schemaVersionHelper: SchemaVersionHelper,
    private operationsReader: OperationsReader,
    private idTranslator: IdTranslator,
    private schemaVersions: SchemaVersionStore,
    private registryChecks: RegistryChecks,
    private appDeployments: AppDeployments,
    private schemaRevisions: SchemaRevisionStore,
    private graphStore: GraphStore,
    @Inject(SCHEMA_MODULE_CONFIG) private schemaModuleConfig: SchemaModuleConfig,
    singleModel: SingleModel,
    compositeModel: CompositeModel,
  ) {
    this.logger = logger.child({ service: 'SchemaPublisher' });
    this.models = {
      [ProjectType.SINGLE]: singleModel,
      [ProjectType.FEDERATION]: compositeModel,
      [ProjectType.STITCHING]: compositeModel,
    };
  }

  private async getBreakingChangeConfiguration({
    selector,
  }: {
    selector: {
      organizationId: string;
      projectId: string;
      targetId: string;
    };
  }): Promise<{
    conditionalBreakingChangeConfiguration: ConditionalBreakingChangeConfiguration | null;
    failDiffOnDangerousChange: boolean;
    failAllDangerousChanges: boolean;
    failDangerousChangeTypes: Types.DangerousChangeType[];
  }> {
    try {
      const settings = await this.targetStore.getTargetSettings(selector);

      if (!settings.validation.isEnabled) {
        this.logger.debug('Usage validation disabled');
        this.logger.debug('Mark all as used');
        return {
          failDiffOnDangerousChange: settings.failDiffOnDangerousChange,
          conditionalBreakingChangeConfiguration: null,
          failAllDangerousChanges: settings.failAllDangerousChanges,
          failDangerousChangeTypes: settings.failDangerousChangeTypes,
        };
      }

      if (settings.validation.isEnabled && settings.validation.targets.length === 0) {
        this.logger.debug('Usage validation enabled but no targets to check against');
        this.logger.debug('Mark all as used');
        return {
          failDiffOnDangerousChange: settings.failDiffOnDangerousChange,
          conditionalBreakingChangeConfiguration: null,
          failAllDangerousChanges: settings.failAllDangerousChanges,
          failDangerousChangeTypes: settings.failDangerousChangeTypes,
        };
      }

      const targetIds = settings.validation.targets;
      const excludedClientNames = settings.validation.excludedClients?.length
        ? settings.validation.excludedClients
        : null;
      const period = createPeriod(`${settings.validation.period}d`);

      const totalRequestCount = await this.operationsReader.getTotalAmountOfRequests({
        targetIds,
        excludedClients: excludedClientNames,
        period,
      });

      return {
        conditionalBreakingChangeConfiguration: {
          conditionalBreakingChangeDiffConfig: {
            period,
            targetIds,
            excludedClientNames: settings.validation.excludedClients?.length
              ? settings.validation.excludedClients
              : null,
            excludedAppDeploymentNames: settings.validation.excludedAppDeployments?.length
              ? settings.validation.excludedAppDeployments
              : null,
            requestCountThreshold:
              settings.validation.breakingChangeFormula === 'PERCENTAGE'
                ? Math.ceil(totalRequestCount * (settings.validation.percentage / 100))
                : settings.validation.requestCount,
          },
          retentionInDays: settings.validation.period,
          percentage: settings.validation.percentage,
          requestCount: settings.validation.requestCount,
          breakingChangeFormula: settings.validation.breakingChangeFormula,
          totalRequestCount,
        },
        failDiffOnDangerousChange: settings.failDiffOnDangerousChange,
        failAllDangerousChanges: settings.failAllDangerousChanges,
        failDangerousChangeTypes: settings.failDangerousChangeTypes,
      };
    } catch (error: unknown) {
      const errorText =
        error instanceof Error
          ? error.toString()
          : typeof error === 'string'
            ? error
            : JSON.stringify(error);
      this.logger.error(`Failed to get settings (error=%s)`, errorText);
      throw error;
    }
  }

  private async getConditionalBreakingChangeMetadata(args: {
    conditionalBreakingChangeConfiguration: null | ConditionalBreakingChangeConfiguration;
    organizationId: string;
    projectId: string;
    targetId: string;
  }): Promise<null | ConditionalBreakingChangeMetadata> {
    if (args.conditionalBreakingChangeConfiguration === null) {
      return null;
    }

    const { conditionalBreakingChangeDiffConfig } = args.conditionalBreakingChangeConfiguration;

    return {
      period: conditionalBreakingChangeDiffConfig.period,
      settings: {
        retentionInDays: args.conditionalBreakingChangeConfiguration.retentionInDays,
        excludedClientNames: conditionalBreakingChangeDiffConfig.excludedClientNames,
        excludedAppDeploymentNames: conditionalBreakingChangeDiffConfig.excludedAppDeploymentNames,
        percentage: args.conditionalBreakingChangeConfiguration.percentage,
        requestCount: args.conditionalBreakingChangeConfiguration.requestCount,
        breakingChangeFormula: args.conditionalBreakingChangeConfiguration.breakingChangeFormula,
        targets: await Promise.all(
          conditionalBreakingChangeDiffConfig.targetIds.map(async targetId => {
            return {
              id: targetId,
              name: (
                await this.targetManager.getTargetById({
                  targetId: targetId,
                })
              ).name,
            };
          }),
        ),
      },
      usage: {
        totalRequestCount: args.conditionalBreakingChangeConfiguration.totalRequestCount,
      },
    };
  }

  @traceFn('SchemaPublisher.internalCheck', {
    initAttributes: input => ({
      'hive.organization.slug': input.target?.bySelector?.organizationSlug,
      'hive.project.slug': input.target?.bySelector?.projectSlug,
      'hive.target.slug': input.target?.bySelector?.targetSlug,
      'hive.target.id': input.target?.byId ?? undefined,
    }),
    resultAttributes: result => ({
      'hive.check.result': result.__typename,
    }),
  })
  private async internalCheck(input: CheckInput) {
    this.logger.info('Checking schema (input=%o)', lodash.omit(input, ['sdl']));

    const selector = await this.idTranslator.resolveTargetReference({
      reference: input.target ?? null,
    });

    if (!selector) {
      this.session.raise('schemaCheck:create');
    }

    trace.getActiveSpan()?.setAttributes({
      'hive.organization.id': selector.organizationId,
      'hive.target.id': selector.targetId,
      'hive.project.id': selector.projectId,
    });

    await this.session.assertPerformAction({
      action: 'schemaCheck:create',
      organizationId: selector.organizationId,
      params: {
        organizationId: selector.organizationId,
        projectId: selector.projectId,
        targetId: selector.targetId,
        serviceName: input.service ?? null,
      },
    });

    const [target, project, organization, graph, schemaProposal] = await Promise.all([
      this.targetStore.getTarget({
        organizationId: selector.organizationId,
        projectId: selector.projectId,
        targetId: selector.targetId,
      }),
      this.projectStore.getProject({
        organizationId: selector.organizationId,
        projectId: selector.projectId,
      }),
      this.storage.getOrganization({
        organizationId: selector.organizationId,
      }),
      this.graphStore.getDefaultGraphForTargetId(selector.targetId),
      input.schemaProposalId
        ? this.schemaProposals.getProposal({
            id: input.schemaProposalId,
          })
        : null,
    ]);

    if (input.schemaProposalId && schemaProposal?.targetId !== selector.targetId) {
      return {
        __typename: 'SchemaCheckError',
        valid: false,
        changes: [],
        warnings: [],
        errors: [
          {
            message:
              'Invalid schema proposal reference. No proposal found with that ID for the target.',
          },
        ],
      } as const;
    }

    const [latestVersion, latestComposableVersion] = await Promise.all([
      this.schemaManager.getLatestSchemaVersionWithSchemaLogsForGraph({
        graph,
      }),
      this.schemaManager.getLatestSchemaVersionWithSchemaLogsForGraph({
        graph,
        onlyComposable: true,
      }),
    ]);

    if (input.service) {
      let serviceExists = false;
      if (latestVersion?.schemas) {
        serviceExists = !!ensureCompositeSchemas(latestVersion.schemas).find(
          ({ service_name }) => service_name === input.service,
        );
      }
      // this is a new service. Validate the service name.
      if (!serviceExists && !isValidServiceName(input.service)) {
        return {
          __typename: 'SchemaCheckError',
          valid: false,
          changes: [],
          warnings: [],
          errors: [
            {
              message:
                'Invalid service name. Service name must be 64 characters or less, must start with a letter, and can only contain alphanumeric characters, dash (-), or underscore (_).',
            },
          ],
        } as const;
      }
    }

    function increaseSchemaCheckCountMetric(conclusion: 'rejected' | 'accepted') {
      schemaCheckCount.inc({
        model: 'modern',
        projectType: project.type,
        conclusion,
      });
    }

    // if url is provided but this is not a distributed project
    if (
      input.url != null &&
      !(project.type === ProjectType.FEDERATION || project.type === ProjectType.STITCHING)
    ) {
      this.logger.debug('url is only supported by distributed projects (type=%s)', project.type);
      increaseSchemaCheckCountMetric('rejected');

      return {
        __typename: 'SchemaCheckError',
        valid: false,
        changes: [],
        warnings: [],
        errors: [
          {
            message: 'url is only supported by distributed projects',
          },
        ],
      } as const;
    }

    if (
      (project.type === ProjectType.FEDERATION || project.type === ProjectType.STITCHING) &&
      input.service == null
    ) {
      this.logger.debug('No service name provided (type=%s)', project.type);
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
      organizationId: project.orgId,
      step: 'checkingSchema',
    });

    const baseSchema = await this.schemaManager.getBaseSchemaForTarget(target);

    const sdl = tryPrettifySDL(input.sdl);
    const baselineSdl = input.baseline ? tryPrettifySDL(input.baseline.sdl) : null;
    const baselineSchemaHash = input.baseline?.hash ?? null;

    const contracts =
      project.type === ProjectType.FEDERATION
        ? await this.contracts.loadActiveContractsWithLatestVersionsForGraphSchemaVersion(
            graph,
            latestVersion?.version ?? null,
          )
        : null;

    let checkResult: SchemaCheckResult;

    let approvedSchemaChanges: Map<string, SchemaChangeType> | null = new Map();
    let approvedContractChanges: Map<string, Map<string, SchemaChangeType>> | null = null;

    if (contextId !== null) {
      approvedSchemaChanges = await this.storage.getApprovedSchemaChangesForContextId({
        targetId: target.id,
        contextId,
      });

      if (contracts?.size) {
        approvedContractChanges = await this.contracts.getApprovedSchemaChangesForContracts({
          contextId,
          contractIds: contracts.keys().toArray(),
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

    const {
      conditionalBreakingChangeConfiguration,
      failDiffOnDangerousChange,
      failAllDangerousChanges,
      failDangerousChangeTypes,
    } = await this.getBreakingChangeConfiguration({
      selector,
    });

    const latestSchemaVersionContracts = latestVersion
      ? await this.contracts.getContractVersionsForSchemaVersion({
          schemaVersionId: latestVersion.version.id,
        })
      : null;

    let proposalChanges: Array<SchemaChangeType> | null = null;
    switch (project.type) {
      case ProjectType.SINGLE:
        this.logger.debug('Using SINGLE registry model');

        if (input.schemaProposalId) {
          try {
            const diffSchema = await this.models[project.type].diffSchema({
              existing: latestVersion
                ? toSingleSchemaInput(ensureSingleSchema(latestVersion.schemas))
                : null,
              incoming: { sdl },
            });
            if ('result' in diffSchema) {
              proposalChanges = diffSchema.result ?? null;
            }
          } catch (e: any) {
            this.logger.error('Could not calculate schema proposal diff: %s', e.message ?? e);
          }
        }

        checkResult = await this.models[ProjectType.SINGLE].check({
          input: { sdl, baselineSdl },
          selector,
          latest: latestVersion
            ? {
                isComposable: latestVersion.version.isComposable,
                sdl: latestVersion.version.compositeSchemaSDL,
                schemas: [toSingleSchemaInput(ensureSingleSchema(latestVersion.schemas))],
              }
            : null,
          latestComposable: latestComposableVersion
            ? {
                isComposable: latestComposableVersion.version.isComposable,
                sdl: latestComposableVersion.version.compositeSchemaSDL,
                schemas: [toSingleSchemaInput(ensureSingleSchema(latestComposableVersion.schemas))],
              }
            : null,
          baseSchema,
          project,
          organization,
          approvedChanges: approvedSchemaChanges,
          conditionalBreakingChangeDiffConfig:
            conditionalBreakingChangeConfiguration?.conditionalBreakingChangeDiffConfig ?? null,
          failDiffOnDangerousChange,
          failAllDangerousChanges,
          failDangerousChangeTypes,
          filterNestedChanges: true,
        });
        break;
      case ProjectType.FEDERATION:
      case ProjectType.STITCHING:
        this.logger.debug('Using %s registry model', project.type);

        if (!input.service) {
          throw new Error('Guard for TypeScript limitations on inferring types. :)');
        }

        if (input.schemaProposalId) {
          try {
            const diffSchema = await this.models[project.type].diffSchema({
              input: {
                sdl,
                serviceName: input.service,
              },
              existing: latestVersion
                ? ensureCompositeSchemas(latestVersion.schemas).map(toCompositeSchemaInput)
                : null,
            });
            if ('result' in diffSchema) {
              proposalChanges = diffSchema.result ?? null;
            }
          } catch (e: any) {
            this.logger.error('Could not calculate schema proposal diff: %s', e.message ?? e);
          }
        }

        checkResult = await this.models[project.type].check({
          input: {
            sdl,
            baselineSdl,
            serviceName: input.service,
            serviceUrl: input.url ?? null,
          },
          selector,
          latest: latestVersion
            ? {
                isComposable: latestVersion.version.isComposable,
                sdl: latestVersion.version.compositeSchemaSDL,
                schemas: ensureCompositeSchemas(latestVersion.schemas).map(toCompositeSchemaInput),
                contractNames:
                  /**
                   * contracts.values() isn't good enough because of an edge case: if a contract that has
                   * failed composition is deleted, the latest version keeps that composition error flag,
                   * which means only a new version can clear it. The deleted contract is no longer one of
                   * the active contracts, so comparing the active contracts against themselves reports
                   * "no changes" and the publish is ignored. The contract versions of the latest version
                   * still include the deleted contract (its contract_id is set to null, the name is kept),
                   * so comparing those against the active contracts detects the removal and a new version
                   * without the contract is created. The publish flow uses the same source so that check
                   * and publish agree.
                   *
                   * This is confusing and subtle, but an important difference in this one case.
                   */
                  latestSchemaVersionContracts?.edges.map(edge => edge.node.contractName) ?? null,
              }
            : null,
          latestComposable: latestComposableVersion
            ? {
                isComposable: latestComposableVersion.version.isComposable,
                sdl: latestComposableVersion.version.compositeSchemaSDL,
                schemas: ensureCompositeSchemas(latestComposableVersion.schemas).map(
                  toCompositeSchemaInput,
                ),
              }
            : null,
          baseSchema,
          project,
          organization,
          approvedChanges: approvedSchemaChanges,
          contracts:
            contracts
              ?.values()
              .map(contract => ({
                ...contract,
                approvedChanges: approvedContractChanges?.get(contract.contract.id) ?? null,
              }))
              .toArray() ?? null,
          conditionalBreakingChangeDiffConfig:
            conditionalBreakingChangeConfiguration?.conditionalBreakingChangeDiffConfig ?? null,
          failDiffOnDangerousChange,
          failAllDangerousChanges,
          failDangerousChangeTypes,
          filterNestedChanges: !input.schemaProposalId,
        });
        break;
      default:
        this.logger.debug('Unsupported project type (type=%s)', project.type);
        throw new HiveError(`${project.type} project not supported`);
    }

    let schemaCheck: null | SchemaCheck = null;

    const retention = await this.rateLimit.getRetention({ targetId: target.id });
    const expiresAt = retention ? new Date(Date.now() + retention * millisecondsPerDay) : null;

    if (input.schemaProposalId) {
      await this.schemaProposals.runBackgroundComposition({
        externalComposition: project.externalComposition,
        native: project.nativeFederation,
        proposalId: input.schemaProposalId,
        targetId: target.id,
      });
    }

    if (checkResult.conclusion === SchemaCheckConclusion.Failure) {
      schemaCheck = await this.storage.createSchemaCheck({
        schemaSDL: sdl,
        // A baseline-aware skip is only returned when baseline, head, and registry match, so the
        // latest registry artifacts are also the exact baseline composition artifacts.
        baselineSchemaSdl: baselineSdl,
        baselineSchemaHash,
        baselinePublicSdl: checkResult.reason.baselineComposition?.compositeSchemaSDL ?? null,
        baselineSupergraphSdl: checkResult.reason.baselineComposition?.supergraphSDL ?? null,
        baselineSchemaCompositionErrors: checkResult.reason.baselineComposition?.errors ?? null,
        serviceName: input.service ?? null,
        serviceUrl: input.url ?? null,
        meta: input.meta ?? null,
        targetId: target.id,
        schemaVersionId: latestVersion?.version.id ?? null,
        isSuccess: false,
        breakingSchemaChanges: checkResult.reason.schemaChanges?.breaking ?? null,
        safeSchemaChanges: checkResult.reason.schemaChanges?.safe ?? null,
        schemaPolicyWarnings: checkResult.reason.schemaPolicy?.warnings ?? null,
        schemaPolicyErrors: checkResult.reason.schemaPolicy?.errors ?? null,
        ...(checkResult.reason.composition.errors
          ? {
              schemaCompositionErrors: checkResult.reason.composition.errors,
              compositeSchemaSDL: null,
              supergraphSDL: null,
            }
          : {
              schemaCompositionErrors: null,
              compositeSchemaSDL: checkResult.reason.composition.compositeSchemaSDL,
              supergraphSDL: checkResult.reason.composition.supergraphSDL,
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
        conditionalBreakingChangeMetadata: await this.getConditionalBreakingChangeMetadata({
          conditionalBreakingChangeConfiguration,
          organizationId: project.orgId,
          projectId: project.id,
          targetId: target.id,
        }),
        contracts:
          checkResult.reason.contracts?.map(contract => ({
            contractId: contract.contractId,
            contractName: contract.contractName,
            comparedContractVersionId:
              contractVersionIdByContractName.get(contract.contractName) ?? null,
            isSuccess: contract.isSuccessful,
            compositeSchemaSdl: contract.composition.compositeSchemaSDL,
            supergraphSchemaSdl: contract.composition.supergraphSDL,
            schemaCompositionErrors: contract.composition.errors ?? null,
            baselineCompositeSchemaSdl: contract.baselineComposition?.compositeSchemaSDL ?? null,
            baselineSupergraphSchemaSdl: contract.baselineComposition?.supergraphSDL ?? null,
            baselineCompositionErrors: contract.baselineComposition?.errors ?? null,
            breakingSchemaChanges: contract.schemaChanges?.breaking ?? null,
            safeSchemaChanges: contract.schemaChanges?.safe ?? null,
          })) ?? null,
        schemaProposalId: input.schemaProposalId ?? null,
        schemaProposalChanges: proposalChanges,
      });
      this.logger.info('created failed schema check. (schemaCheckId=%s)', schemaCheck.id);
    } else if (checkResult.conclusion === SchemaCheckConclusion.Success) {
      schemaCheck = await this.storage.createSchemaCheck({
        schemaSDL: sdl,
        baselineSchemaSdl: baselineSdl,
        baselineSchemaHash,
        baselinePublicSdl: checkResult.state.baselineComposition?.compositeSchemaSDL ?? null,
        baselineSupergraphSdl: checkResult.state.baselineComposition?.supergraphSDL ?? null,
        baselineSchemaCompositionErrors: checkResult.state.baselineComposition?.errors ?? null,
        serviceName: input.service ?? null,
        serviceUrl: input.url ?? null,
        meta: input.meta ?? null,
        targetId: target.id,
        schemaVersionId: latestVersion?.version.id ?? null,
        isSuccess: true,
        breakingSchemaChanges: checkResult.state?.schemaChanges?.breaking ?? null,
        safeSchemaChanges: checkResult.state?.schemaChanges?.safe ?? null,
        schemaPolicyWarnings: checkResult.state?.schemaPolicy?.warnings ?? null,
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
        conditionalBreakingChangeMetadata: await this.getConditionalBreakingChangeMetadata({
          conditionalBreakingChangeConfiguration,
          organizationId: project.orgId,
          projectId: project.id,
          targetId: target.id,
        }),
        contracts:
          checkResult.state?.contracts?.map(contract => ({
            contractId: contract.contractId,
            contractName: contract.contractName,
            comparedContractVersionId:
              contractVersionIdByContractName.get(contract.contractName) ?? null,
            isSuccess: contract.isSuccessful,
            compositeSchemaSdl: contract.composition.compositeSchemaSDL,
            supergraphSchemaSdl: contract.composition.supergraphSDL,
            baselineCompositeSchemaSdl: contract.baselineComposition?.compositeSchemaSDL ?? null,
            baselineSupergraphSchemaSdl: contract.baselineComposition?.supergraphSDL ?? null,
            baselineCompositionErrors: contract.baselineComposition?.errors ?? null,
            schemaCompositionErrors: null,
            breakingSchemaChanges: contract.schemaChanges?.breaking ?? null,
            safeSchemaChanges: contract.schemaChanges?.safe ?? null,
          })) ?? null,
        schemaProposalId: input.schemaProposalId ?? null,
        schemaProposalChanges: proposalChanges,
      });
      this.logger.info('created successful schema check. (schemaCheckId=%s)', schemaCheck.id);
    } else if (checkResult.conclusion === SchemaCheckConclusion.Skip) {
      if (!latestVersion) {
        throw new Error('This cannot happen 1 :)');
      }

      const [compositeSchemaSdl, supergraphSdl, compositionErrors] = await Promise.all([
        this.schemaVersionHelper.getCompositeSchemaSdl(latestVersion.version),
        this.schemaVersionHelper.getSupergraphSdl(latestVersion.version),
        this.schemaVersionHelper.getSchemaCompositionErrors(latestVersion.version),
      ]);

      schemaCheck = await this.storage.createSchemaCheck({
        schemaSDL: sdl,
        baselineSchemaSdl: baselineSdl,
        baselineSchemaHash,
        baselineSchemaCompositionErrors: baselineSdl ? compositionErrors : null,
        baselineSupergraphSdl: baselineSdl ? supergraphSdl : null,
        baselinePublicSdl: baselineSdl ? compositeSchemaSdl : null,
        serviceName: input.service ?? null,
        serviceUrl: input.url ?? null,
        meta: input.meta ?? null,
        targetId: target.id,
        schemaVersionId: latestVersion.version.id ?? null,
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
        conditionalBreakingChangeMetadata: await this.getConditionalBreakingChangeMetadata({
          conditionalBreakingChangeConfiguration,
          organizationId: project.orgId,
          projectId: project.id,
          targetId: target.id,
        }),
        contracts: latestSchemaVersionContracts
          ? await Promise.all(
              latestSchemaVersionContracts?.edges.map(async edge => ({
                contractId: edge.node.contractId ?? fail('contract id must exist.'),
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
                isSuccess: !edge.node.schemaCompositionErrors,
                compositeSchemaSdl: edge.node.compositeSchemaSdl,
                supergraphSchemaSdl: edge.node.supergraphSdl,
                schemaCompositionErrors: edge.node.schemaCompositionErrors,
                baselineCompositionErrors: baselineSdl ? edge.node.schemaCompositionErrors : null,
                baselineSupergraphSchemaSdl: baselineSdl ? edge.node.supergraphSdl : null,
                baselineCompositeSchemaSdl: baselineSdl ? edge.node.compositeSchemaSdl : null,
                breakingSchemaChanges: null,
                safeSchemaChanges: null,
              })),
            )
          : null,
        schemaProposalId: input.schemaProposalId ?? null,
        schemaProposalChanges: proposalChanges,
      });
      this.logger.info('created skipped schema check. (schemaCheckId=%s)', schemaCheck.id);
    }

    const schemaCheckSelector = {
      organizationId: target.orgId,
      projectId: target.projectId,
    };
    const graphQLSchemaCheck = schemaCheck
      ? toGraphQLSchemaCheck(schemaCheckSelector, schemaCheck)
      : null;

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
          contractChanges:
            checkResult.state.contracts
              ?.map(contract => ({
                contractName: contract.contractName,
                changes: contract.schemaChanges?.all ?? [],
              }))
              .filter(contract => contract.changes.length > 0) ?? null,
          breakingChanges: checkResult.state?.schemaChanges?.breaking ?? null,
          warnings: checkResult.state?.schemaPolicy?.warnings ?? null,
          compositionErrors: null,
          errors: null,
          schemaCheckId: schemaCheck?.id ?? null,
          schemaCheck: graphQLSchemaCheck,
          githubCheckRun: githubCheckRun,
          failedContractCompositionCount,
        });
      }

      if (checkResult.conclusion === SchemaCheckConclusion.Failure) {
        const { errors, failedContractCompositionCount } = getSchemaCheckFailureGithubDetails(
          checkResult.reason,
        );

        increaseSchemaCheckCountMetric('rejected');
        return await this.updateGithubCheckRunForSchemaCheck({
          project,
          target,
          organization,
          conclusion: checkResult.conclusion,
          changes: checkResult.reason.schemaChanges?.all ?? null,
          contractChanges: null,
          breakingChanges: checkResult.reason.schemaChanges?.breaking ?? [],
          compositionErrors: checkResult.reason.composition.errors ?? [],
          warnings: checkResult.reason.schemaPolicy?.warnings ?? [],
          errors,
          schemaCheckId: schemaCheck?.id ?? null,
          schemaCheck: graphQLSchemaCheck,
          githubCheckRun: githubCheckRun,
          failedContractCompositionCount,
        });
      }

      // SchemaCheckConclusion.Skip

      if (!latestVersion) {
        throw new Error('This cannot happen 2 :)');
      }

      if (latestVersion.version.isComposable) {
        increaseSchemaCheckCountMetric('accepted');
        const contracts = await this.contracts.getContractVersionsForSchemaVersion({
          schemaVersionId: latestVersion.version.id,
        });
        const failedContractCompositionCount =
          contracts?.edges.filter(edge => edge.node.schemaCompositionErrors !== null).length ?? 0;

        return await this.updateGithubCheckRunForSchemaCheck({
          project,
          target,
          organization,
          conclusion: SchemaCheckConclusion.Success,
          changes: null,
          contractChanges: null,
          breakingChanges: null,
          warnings: null,
          compositionErrors: null,
          errors: null,
          schemaCheckId: schemaCheck?.id ?? null,
          schemaCheck: graphQLSchemaCheck,
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
        contractChanges: null,
        breakingChanges: null,
        compositionErrors: latestVersion.version.schemaCompositionErrors,
        warnings: null,
        errors: null,
        schemaCheckId: schemaCheck?.id ?? null,
        schemaCheck: graphQLSchemaCheck,
        githubCheckRun: githubCheckRun,
        failedContractCompositionCount: 0,
      });
    }

    if (schemaCheck == null) {
      throw new Error('Invalid state. Schema check can not be null at this point.');
    }

    if (checkResult.conclusion === SchemaCheckConclusion.Success) {
      increaseSchemaCheckCountMetric('accepted');
      return {
        __typename: 'SchemaCheckSuccess',
        valid: true,
        schemaProposalChanges: schemaCheck.schemaProposalChanges,
        changes: [
          ...(checkResult.state?.schemaChanges?.all ?? []),
          ...(checkResult.state?.contracts?.flatMap(contract => [
            ...(contract.schemaChanges?.all?.map(change => ({
              ...change,
              message: `[${contract.contractName}] ${change.message}`,
            })) ?? []),
          ]) ?? []),
        ],
        warnings: checkResult.state?.schemaPolicy?.warnings ?? [],
        initial: latestVersion == null,
        schemaCheck: toGraphQLSchemaCheck(schemaCheckSelector, schemaCheck),
      } as const;
    }

    if (checkResult.conclusion === SchemaCheckConclusion.Failure) {
      increaseSchemaCheckCountMetric('rejected');

      const errors: Array<{ message: string; path?: string | null }> = [];

      if (checkResult.reason.baselineComposition?.type === 'failure') {
        errors.push({
          message: 'Baseline composition failed.',
        });
      }

      if (checkResult.reason.schemaChanges?.breaking) {
        errors.push(
          ...checkResult.reason.schemaChanges.breaking.filter(
            breaking => breaking.approvalMetadata == null && breaking.isSafeBasedOnUsage === false,
          ),
        );
      }

      if (checkResult.reason.schemaPolicy?.errors) {
        errors.push(...checkResult.reason.schemaPolicy.errors.map(formatPolicyError));
      }

      if (checkResult.reason.composition.errors) {
        errors.push(...checkResult.reason.composition.errors);
      }

      if (checkResult.reason.contracts) {
        for (const contract of checkResult.reason.contracts) {
          if (!contract.baselineComposition?.errors) {
            continue;
          }

          errors.push({ message: `[${contract.contractName}] Baseline composition failed.` });
        }
        for (const contract of checkResult.reason.contracts) {
          if (!contract.composition.errors) {
            continue;
          }

          errors.push(
            ...contract.composition.errors.map(error => ({
              ...error,
              message: `[${contract.contractName}] ${error.message}`,
            })),
          );
        }

        for (const contract of checkResult.reason.contracts) {
          if (!contract.schemaChanges?.breaking) {
            continue;
          }

          errors.push(
            ...contract.schemaChanges.breaking
              .filter(
                breaking =>
                  breaking.approvalMetadata == null && breaking.isSafeBasedOnUsage === false,
              )
              .map(change => ({
                ...change,
                message: `[${contract.contractName}] ${change.message}`,
              })),
          );
        }
      }

      return {
        __typename: 'SchemaCheckError',
        valid: false,
        schemaProposalChanges: schemaCheck.schemaProposalChanges,
        changes: [
          ...(checkResult.reason.schemaChanges?.all ?? []),
          ...(checkResult.reason.contracts?.flatMap(contract => [
            ...(contract.schemaChanges?.all?.map(change => ({
              ...change,
              message: `[${contract.contractName}] ${change.message}`,
            })) ?? []),
          ]) ?? []),
        ],
        warnings: checkResult.reason.schemaPolicy?.warnings ?? [],
        errors,
        schemaCheck: toGraphQLSchemaCheck(schemaCheckSelector, schemaCheck),
      } as const;
    }

    // SchemaCheckConclusion.Skip

    if (!latestVersion) {
      throw new Error('This cannot happen 3 :)');
    }

    if (latestVersion.version.isComposable) {
      increaseSchemaCheckCountMetric('accepted');
      return {
        __typename: 'SchemaCheckSuccess',
        valid: true,
        schemaProposalChanges: schemaCheck.schemaProposalChanges,
        changes: [],
        warnings: [],
        initial: false,
        schemaCheck: toGraphQLSchemaCheck(schemaCheckSelector, schemaCheck),
      } as const;
    }

    const contractVersions = await this.contracts.getContractVersionsForSchemaVersion({
      schemaVersionId: latestVersion.version.id,
    });

    increaseSchemaCheckCountMetric('rejected');
    return {
      __typename: 'SchemaCheckError',
      valid: false,
      schemaProposalChanges: schemaCheck.schemaProposalChanges,
      changes: [],
      warnings: [],
      errors: [
        ...(latestVersion.version.schemaCompositionErrors?.map(error => ({
          message: error.message,
          source: error.source,
        })) ?? []),
        ...(contractVersions?.edges.flatMap(edge => [
          ...(edge.node.schemaCompositionErrors?.map(error => ({
            message: `[${edge.node.contractName}] ${error.message}`,
            source: error.source,
          })) ?? []),
        ]) ?? []),
      ],
      schemaCheck: toGraphQLSchemaCheck(schemaCheckSelector, schemaCheck),
    } as const;
  }

  async check(input: CheckInput) {
    return await this.internalCheck(input).then(
      result => {
        registryOperationOutcomeCount.inc({ operation: 'check', conclusion: 'success' });
        return result;
      },
      error => {
        if (error instanceof HiveError) {
          registryOperationOutcomeCount.inc({ operation: 'check', conclusion: 'success' });
        } else {
          registryOperationOutcomeCount.inc({ operation: 'check', conclusion: 'failure' });
          registryOperationUnexpectedErrorCount.inc(unexpectedErrorMetricLabels('check', error));
        }
        throw error;
      },
    );
  }

  @traceFn('SchemaPublisher.publish', {
    initAttributes: (input, _) => ({
      'hive.organization.slug': input.target?.bySelector?.organizationSlug,
      'hive.project.slug': input.target?.bySelector?.projectSlug,
      'hive.target.slug': input.target?.bySelector?.targetSlug,
      'hive.target.id': input.target?.byId ?? undefined,
    }),
    resultAttributes: result => ({
      'hive.publish.result': result.__typename,
    }),
  })
  async publish(input: PublishInput, signal: AbortSignal): Promise<PublishResult> {
    return this.internalPublishRequest(input, signal).then(
      result => {
        registryOperationOutcomeCount.inc({
          operation: 'publish',
          conclusion: 'success',
        });
        return result;
      },
      error => {
        if (error instanceof HiveError) {
          registryOperationOutcomeCount.inc({ operation: 'publish', conclusion: 'success' });
        } else {
          registryOperationOutcomeCount.inc({ operation: 'publish', conclusion: 'failure' });
          registryOperationUnexpectedErrorCount.inc(unexpectedErrorMetricLabels('publish', error));
        }
        throw error;
      },
    );
  }

  private async internalPublishRequest(
    input: PublishInput,
    signal: AbortSignal,
  ): Promise<PublishResult> {
    this.logger.debug('Start schema publication.');

    const selector = await this.idTranslator.resolveTargetReference({
      reference: input.target ?? null,
    });

    if (!selector) {
      this.session.raise('schemaVersion:publish');
    }

    trace.getActiveSpan()?.setAttributes({
      'hive.organization.id': selector.organizationId,
      'hive.target.id': selector.targetId,
      'hive.project.id': selector.projectId,
    });

    await this.session.assertPerformAction({
      action: 'schemaVersion:publish',
      organizationId: selector.organizationId,
      params: {
        targetId: selector.targetId,
        projectId: selector.projectId,
        organizationId: selector.organizationId,
        serviceName: input.service ?? null,
      },
    });

    this.logger.debug(
      'Compute hash (organization=%s, project=%s, target=%s)',
      selector.organizationId,
      selector.projectId,
      selector.targetId,
    );

    const [graph, project] = await Promise.all([
      this.graphStore.getDefaultGraphForTargetId(selector.targetId),
      this.projectStore.getProject({
        organizationId: selector.organizationId,
        projectId: selector.projectId,
      }),
    ]);

    if (input.sdl != null && input.schema != null) {
      throw new GraphQLError(
        "Provide exactly one schema source: 'PublishInput.sdl' or 'PublishInput.schema'.",
      );
    }

    if (project.type !== Types.ProjectType.SINGLE && !input.service) {
      return {
        __typename: 'SchemaPublishMissingServiceError' as const,
        message: 'Missing service name',
      } as const;
    }

    let revisionId: string | null = null;
    let revisionName: string | null = null;
    let resolvedSdl = input.sdl ?? input.schema?.sdl ?? null;

    if (input.schema?.revision != null) {
      const revision = await this.schemaRevisions.getByRevision({
        projectId: selector.projectId,
        service: project.type === Types.ProjectType.SINGLE ? null : (input.service ?? null),
        revision: input.schema.revision,
      });

      if (!revision) {
        return revisionNotFoundResult(input.schema.revision);
      }
      revisionId = revision.id;
      revisionName = revision.revision;
      resolvedSdl = revision.sdl;
    }

    invariant(resolvedSdl !== null, 'No SDL resolved.');

    const { schema: _, ...inputWithoutSchema } = input;
    const publishInput: ResolvedPublishInput = {
      ...inputWithoutSchema,
      sdl: resolvedSdl,
      schemaRevisionId: revisionId,
      revision: revisionName,
    };

    const [contracts, latestVersion] = await Promise.all([
      this.contracts.getActiveContractsByTargetId({ targetId: selector.targetId }),
      this.schemaManager.getLatestSchemaVersionWithSchemaLogsForGraph({
        graph,
      }),
    ]);

    if (project.type !== Types.ProjectType.SINGLE) {
      invariant(input.service, 'Service name is required for composite projects.');

      let serviceExists = false;
      if (latestVersion?.schemas) {
        serviceExists = !!ensureCompositeSchemas(latestVersion.schemas).find(
          ({ service_name }) => service_name === input.service,
        );
      }

      // this is a new service. Validate the service name.
      if (!serviceExists && !isValidServiceName(input.service)) {
        return {
          __typename: 'SchemaPublishError',
          valid: false,
          changes: [],
          errors: [
            {
              message:
                'Invalid service name. Service name must be 64 characters or less, must start with a letter, and can only contain alphanumeric characters, dash (-), or underscore (_).',
            },
          ],
        };
      }
    }

    const checksum = createHash('md5')
      .update(
        stringify({
          ...publishInput,
          organization: selector.organizationId,
          project: selector.projectId,
          target: selector.targetId,
          service: input.service?.toLowerCase(),
          contracts: contracts?.map(contract => ({
            contractId: contract.id,
            contractName: contract.contractName,
          })),
          // We include the latest version ID to avoid caching a schema publication that targets different versions.
          // When deleting a schema, and publishing it again, the latest version ID will be different.
          // If we don't include it, the cache will return the previous result.
          latestVersionId: latestVersion?.version.id,
        }),
      )
      .update(this.session.id)
      .digest('base64');

    this.logger.debug(
      'Hash computation finished (organization=%s, project=%s, target=%s, hash=%s)',
      selector.organizationId,
      selector.projectId,
      selector.targetId,
    );

    return this.mutex
      .perform(
        registryLockId(selector.targetId),
        {
          /**
           * The global request timeout is 60 seconds.
           * We don't want to try acquiring the lock longer than 30 seconds.
           * If it succeeds after 30 seconds,
           * we have 30 seconds for actually running the business logic.
           *
           * If we would wait longer we risk the user facing 504 errors.
           */
          retries: 30,
          retryDelay: 1_000,
          signal,
        },
        async () => {
          return this.distributedCache.wrap({
            key: `schema:publish:${checksum}`,
            ttlSeconds: 15,
            executor: () =>
              this.internalPublish({
                ...publishInput,
                sdl: tryPrettifySDL(publishInput.sdl),
                checksum,
                selector,
              }),
          });
        },
      )
      .catch((error: unknown) => {
        if (error instanceof MutexResourceLockedError) {
          if (input.supportsRetry === true) {
            return {
              __typename: 'SchemaPublishRetry',
              reason: 'Another schema publish is currently in progress.',
            } satisfies PublishResult;
          }

          return {
            __typename: 'SchemaPublishError',
            valid: false,
            changes: [],
            errors: [
              {
                message:
                  'Another schema publish is currently in progress. Please retry the publish.',
              },
            ],
          } satisfies PublishResult;
        }

        throw error;
      });
  }

  @traceFn('SchemaPublisher.delete', {
    initAttributes: (input, _) => ({
      'hive.organization.slug': input.target?.bySelector?.organizationSlug,
      'hive.project.slug': input.target?.bySelector?.projectSlug,
      'hive.target.slug': input.target?.bySelector?.targetSlug,
      'hive.target.id': input.target?.byId ?? undefined,
    }),
    resultAttributes: result => ({
      'hive.delete.result': result.__typename,
    }),
  })
  async delete(input: DeleteInput, signal: AbortSignal) {
    return this.internalDeleteRequest(input, signal).then(
      result => {
        registryOperationOutcomeCount.inc({
          operation: 'delete',
          conclusion: 'success',
        });
        return result;
      },
      error => {
        if (error instanceof HiveError) {
          registryOperationOutcomeCount.inc({
            operation: 'delete',
            conclusion: 'success',
          });
        } else {
          registryOperationOutcomeCount.inc({ operation: 'delete', conclusion: 'failure' });
          registryOperationUnexpectedErrorCount.inc(unexpectedErrorMetricLabels('delete', error));
        }
        throw error;
      },
    );
  }

  private toCreateContractVersionInput(
    contract: ContractWithLatestVersions,
    contractCompositionResult: ContractResult,
  ): CreateContractVersionInput {
    return {
      contractId: contractCompositionResult.contractId,
      graph: contract.graph,
      contractName: contractCompositionResult.contractName,
      compositeSchemaSDL: contractCompositionResult.fullSchemaSdl,
      supergraphSDL: contractCompositionResult.supergraph,
      schemaCompositionErrors: contractCompositionResult.compositionErrors,
      changes: contractCompositionResult.changes,
      supergraphChanges: contractCompositionResult.supergraphChanges,
      diffSchemaVersionId: contract.latestValidVersion?.id ?? null,
      previousSchemaVersionId: contract.latestVersion?.id ?? null,
    };
  }

  private async internalDeleteRequest(input: DeleteInput, signal: AbortSignal) {
    this.logger.info('Deleting schema (input=%o)', input);

    const selector = await this.idTranslator.resolveTargetReference({
      reference: input.target ?? null,
    });

    if (!selector) {
      this.session.raise('schemaVersion:deleteService');
    }

    trace.getActiveSpan()?.setAttributes({
      'hive.organization.id': selector.organizationId,
      'hive.target.id': selector.targetId,
      'hive.project.id': selector.projectId,
    });

    await this.session.assertPerformAction({
      action: 'schemaVersion:deleteService',
      organizationId: selector.organizationId,
      params: {
        organizationId: selector.organizationId,
        projectId: selector.projectId,
        targetId: selector.targetId,
        serviceName: input.serviceName,
      },
    });

    return this.mutex
      .perform(
        registryLockId(selector.targetId),
        {
          signal,
        },
        async () => {
          const [organization, project, target, graph] = await Promise.all([
            this.storage.getOrganization({
              organizationId: selector.organizationId,
            }),
            this.projectStore.getProject({
              organizationId: selector.organizationId,
              projectId: selector.projectId,
            }),
            this.targetStore.getTarget({
              organizationId: selector.organizationId,
              projectId: selector.projectId,
              targetId: selector.targetId,
            }),
            this.graphStore.getDefaultGraphForTargetId(selector.targetId),
          ]);

          schemaDeleteCount.inc({ model: 'modern', projectType: project.type });

          if (project.type !== ProjectType.FEDERATION && project.type !== ProjectType.STITCHING) {
            throw new HiveError(`${project.type} project not supported`);
          }

          const [latestVersion, latestComposableVersion, baseSchema] = await Promise.all([
            this.schemaManager.getLatestSchemaVersionWithSchemaLogsForGraph({
              graph,
            }),
            this.schemaManager.getLatestSchemaVersionWithSchemaLogsForGraph({
              graph,
              onlyComposable: true,
            }),
            this.storage.getBaseSchema({
              organizationId: selector.organizationId,
              projectId: selector.projectId,
              targetId: selector.targetId,
            }),
          ]);

          if (!latestVersion || latestVersion.schemas.length === 0) {
            throw new HiveError('Registry is empty');
          }

          const schemas = ensureCompositeSchemas(latestVersion.schemas);
          this.logger.debug(`Found ${latestVersion?.schemas.length ?? 0} most recent schemas`);
          this.logger.debug(
            'Using %s registry model (featureFlags=%o)',
            project.type,
            organization.featureFlags,
          );

          const affectedService = schemas.find(s => s.service_name === input.serviceName);

          if (!affectedService) {
            return {
              __typename: 'SchemaDeleteError',
              valid: false,
              errors: [
                {
                  message: `Service "${input.serviceName}" not found`,
                },
              ],
            } as const;
          }

          const {
            conditionalBreakingChangeConfiguration,
            failDiffOnDangerousChange,
            failAllDangerousChanges,
            failDangerousChangeTypes,
          } = await this.getBreakingChangeConfiguration({
            selector: {
              targetId: selector.targetId,
              projectId: selector.projectId,
              organizationId: selector.organizationId,
            },
          });

          const contracts =
            project.type === ProjectType.FEDERATION
              ? await this.contracts.loadActiveContractsWithLatestVersionsForGraphSchemaVersion(
                  graph,
                  latestVersion.version,
                )
              : null;

          const deleteResult = await this.models[project.type].delete({
            input: {
              serviceName: input.serviceName,
            },
            latest: {
              isComposable: latestVersion.version.isComposable,
              sdl: latestVersion.version.compositeSchemaSDL,
              schemas: schemas.map(toCompositeSchemaInput),
            },
            latestComposable: latestComposableVersion
              ? {
                  isComposable: latestComposableVersion.version.isComposable,
                  sdl: latestComposableVersion.version.compositeSchemaSDL ?? null,
                  supergraphSdl: latestComposableVersion.version.supergraphSDL,
                  schemas: ensureCompositeSchemas(latestComposableVersion.schemas).map(
                    toCompositeSchemaInput,
                  ),
                }
              : null,
            baseSchema,
            project,
            organization,
            selector: {
              target: selector.targetId,
              project: selector.projectId,
              organization: selector.organizationId,
            },
            conditionalBreakingChangeDiffConfig:
              conditionalBreakingChangeConfiguration?.conditionalBreakingChangeDiffConfig ?? null,
            contracts: contracts?.size ? Array.from(contracts.values()) : null,
            failDiffOnDangerousChange,
            failAllDangerousChanges,
            failDangerousChangeTypes,
          });

          if (deleteResult.conclusion === SchemaDeleteConclusion.Accept) {
            this.logger.debug('Delete accepted');
            if (input.dryRun !== true) {
              const schemaVersion = await this.schemaVersions.deleteSubgraphFromGraph(graph, {
                service: {
                  name: affectedService.service_name,
                  versionId: affectedService.id,
                },
                composable: deleteResult.state.composable,
                diffSchemaVersionId: latestComposableVersion?.version.id ?? null,
                changes: deleteResult.state.changes,
                contracts:
                  deleteResult.state.contracts?.map(contractResult => {
                    const contract = contracts?.get(contractResult.contractId);
                    invariant(contract, 'Contract should exist.');
                    return this.toCreateContractVersionInput(contract, contractResult);
                  }) ?? null,
                ...(deleteResult.state.fullSchemaSdl
                  ? {
                      compositeSchemaSDL: deleteResult.state.fullSchemaSdl,
                      supergraphSDL: deleteResult.state.supergraph,
                      supergraphChanges: deleteResult.state.supergraphChanges,
                      schemaCompositionErrors: null,
                      tags: deleteResult.state.tags,
                      schemaMetadata: deleteResult.state.schemaMetadata,
                      metadataAttributes: deleteResult.state.metadataAttributes,
                    }
                  : {
                      compositeSchemaSDL: null,
                      supergraphSDL: null,
                      supergraphChanges: null,
                      schemaCompositionErrors: deleteResult.state.compositionErrors ?? [],
                      tags: null,
                      schemaMetadata: null,
                      metadataAttributes: null,
                    }),
                actionFn: async (versionId: string) => {
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
                      target,
                      project,
                      supergraph: deleteResult.state.supergraph,
                      fullSchemaSdl: deleteResult.state.fullSchemaSdl,
                      // pass all schemas except the one we are deleting
                      schemas: deleteResult.state.schemas,
                      contracts,
                      versionId,
                    });
                  }
                },
                conditionalBreakingChangeMetadata: await this.getConditionalBreakingChangeMetadata({
                  conditionalBreakingChangeConfiguration,
                  organizationId: selector.organizationId,
                  projectId: selector.projectId,
                  targetId: selector.targetId,
                }),
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
                    target,
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

          if (compositionErrors?.length) {
            errors.push(...compositionErrors);
          }

          return {
            __typename: 'SchemaDeleteError',
            valid: false,
            errors,
          } as const;
        },
      )
      .catch((error: unknown) => {
        if (error instanceof MutexResourceLockedError) {
          if (input.supportsRetry === true) {
            return {
              __typename: 'SchemaDeleteRetry',
              reason: 'Another schema operation is currently in progress.',
            } as const;
          }

          return {
            __typename: 'SchemaDeleteError',
            valid: false,
            changes: [],
            errors: [
              {
                message:
                  'Another schema operation is currently in progress. Please retry the delete.',
              },
            ],
          } as const;
        }
        throw error;
      });
  }

  private async internalPublish(
    input: ResolvedPublishInput & {
      checksum: string;
      selector: TargetSelector;
    },
  ) {
    const [organizationId, projectId, targetId] = [
      input.selector.organizationId,
      input.selector.projectId,
      input.selector.targetId,
    ];
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

    const [organization, project, target, baseSchema, graph] = await Promise.all([
      this.storage.getOrganization({
        organizationId: organizationId,
      }),
      this.projectStore.getProject({
        organizationId: organizationId,
        projectId: projectId,
      }),
      this.targetStore.getTarget({
        organizationId: organizationId,
        projectId: projectId,
        targetId: targetId,
      }),
      this.storage.getBaseSchema({
        organizationId: organizationId,
        projectId: projectId,
        targetId: targetId,
      }),
      this.graphStore.getDefaultGraphForTargetId(targetId),
    ]);

    const [latestVersion, latestComposable] = await Promise.all([
      this.schemaManager.getLatestSchemaVersionWithSchemaLogsForGraph({
        graph,
      }),
      this.schemaManager.getLatestSchemaVersionWithSchemaLogsForGraph({
        graph,
        onlyComposable: true,
      }),
    ]);

    trace.getActiveSpan()?.setAttributes({
      'hive.latestSchemaVersion.id': latestVersion?.version.id ?? 'no prior version',
    });

    function increaseSchemaPublishCountMetric(conclusion: 'rejected' | 'accepted' | 'ignored') {
      schemaPublishCount.inc({
        model: 'modern',
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
      organizationId: project.orgId,
      step: 'publishingSchema',
    });

    this.logger.debug(`Found ${latestVersion?.schemas.length ?? 0} most recent schemas`);

    const {
      conditionalBreakingChangeConfiguration,
      failDiffOnDangerousChange,
      failAllDangerousChanges,
      failDangerousChangeTypes,
    } = await this.getBreakingChangeConfiguration({
      selector: {
        organizationId: organization.id,
        projectId: project.id,
        targetId: target.id,
      },
    });

    const contracts =
      project.type === ProjectType.FEDERATION
        ? await this.contracts.loadActiveContractsWithLatestVersionsForGraphSchemaVersion(
            graph,
            latestVersion?.version ?? null,
          )
        : null;

    const latestSchemaVersionContracts = latestVersion
      ? await this.contracts.getContractVersionsForSchemaVersion({
          schemaVersionId: latestVersion.version.id,
        })
      : null;

    let publishResult: SchemaPublishResult;

    switch (project.type) {
      case ProjectType.SINGLE:
        this.logger.debug(
          'Using SINGLE registry model (featureFlags=%o)',
          organization.featureFlags,
        );
        publishResult = await this.models[ProjectType.SINGLE].publish({
          input: {
            sdl: input.sdl,
            metadata: input.metadata ?? null,
            skipNoChangesCheck: input.schemaRevisionId !== null,
          },
          latest: latestVersion
            ? {
                isComposable: latestVersion.version.isComposable,
                sdl: latestVersion.version.compositeSchemaSDL,
                schemas: [toSingleSchemaInput(ensureSingleSchema(latestVersion.schemas))],
              }
            : null,
          latestComposable: latestComposable
            ? {
                isComposable: latestComposable.version.isComposable,
                sdl: latestComposable.version.compositeSchemaSDL,
                schemas: [toSingleSchemaInput(ensureSingleSchema(latestComposable.schemas))],
              }
            : null,
          organization,
          project,
          target,
          baseSchema,
          conditionalBreakingChangeDiffConfig:
            conditionalBreakingChangeConfiguration?.conditionalBreakingChangeDiffConfig ?? null,
          failDiffOnDangerousChange,
          failAllDangerousChanges,
          failDangerousChangeTypes,
        });
        break;
      case ProjectType.FEDERATION:
      case ProjectType.STITCHING:
        this.logger.debug(
          'Using %s registry model (featureFlags=%o)',
          project.type,
          organization.featureFlags,
        );

        if (!input.service) {
          throw new Error('Invalid state. input.service should have been validated by now.');
        }

        publishResult = await this.models[project.type].publish({
          input: {
            sdl: input.sdl,
            service: input.service,
            metadata: input.metadata ?? null,
            url: input.url ?? null,
            skipNoChangesCheck: input.schemaRevisionId !== null,
          },
          latest: latestVersion
            ? {
                isComposable: latestVersion.version.isComposable,
                sdl: latestVersion.version.compositeSchemaSDL,
                schemas: ensureCompositeSchemas(latestVersion.schemas).map(toCompositeSchemaInput),
                contractNames:
                  latestSchemaVersionContracts?.edges.map(edge => edge.node.contractName) ?? null,
              }
            : null,
          latestComposable: latestComposable
            ? {
                isComposable: latestComposable.version.isComposable,
                sdl: latestComposable.version.compositeSchemaSDL,
                supergraphSdl: latestComposable.version.supergraphSDL,
                schemas: ensureCompositeSchemas(latestComposable.schemas).map(
                  toCompositeSchemaInput,
                ),
              }
            : null,
          organization,
          project,
          target,
          baseSchema,
          contracts: contracts?.values().toArray() ?? null,
          conditionalBreakingChangeDiffConfig:
            conditionalBreakingChangeConfiguration?.conditionalBreakingChangeDiffConfig ?? null,
          failDiffOnDangerousChange,
          failAllDangerousChanges,
          failDangerousChangeTypes,
        });
        break;
      default: {
        this.logger.debug('Unsupported project type (type=%s)', project.type);
        throw new HiveError(`${project.type} project not supported`);
      }
    }

    if (publishResult.conclusion === SchemaPublishConclusion.Ignore) {
      this.logger.debug('Publish ignored (reasons=%s)', publishResult.reason);

      increaseSchemaPublishCountMetric('ignored');

      const linkToWebsite =
        typeof this.schemaModuleConfig.schemaPublishLink === 'function'
          ? this.schemaModuleConfig.schemaPublishLink({
              organization: {
                slug: organization.slug,
              },
              project: {
                slug: project.slug,
              },
              target: {
                slug: target.slug,
              },
              version: latestVersion ? { id: latestVersion.version.id } : undefined,
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

    const contractCompositionErrors =
      publishResult.state.contracts?.flatMap(
        contract =>
          contract.compositionErrors?.map(err => ({
            ...err,
            message: `[${contract.contractName}] ${err.message}`,
          })) ?? [],
      ) ?? [];

    if (
      project.type === ProjectType.FEDERATION &&
      input.failOnCompositionError === true &&
      (publishResult.state.composable === false || contractCompositionErrors.length > 0)
    ) {
      this.logger.debug('Publish rejected because it would cause a composition error');
      increaseSchemaPublishCountMetric('rejected');

      const errors = [
        ...(publishResult.state.compositionErrors ?? []),
        ...contractCompositionErrors,
      ];

      if (githubCheckRun) {
        return this.updateGithubCheckRunForSchemaPublish({
          githubCheckRun,
          force: false,
          initial: false,
          valid: false,
          changes: [],
          errors,
          organizationId: organization.id,
          detailsUrl: null,
        });
      }

      return {
        __typename: 'SchemaPublishError' as const,
        valid: false,
        changes: [],
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
    const previousSchemaLogs = schemas
      .filter(s => s.id !== pushedSchema.id) // do not include the incoming schema
      .map(s => ({
        id: s.id,
        serviceName: s.serviceName,
      }));

    const supergraph = publishResult.state.supergraph ?? null;

    this.logger.debug(`Assigning ${previousSchemaLogs.length} schemas to new version`);

    const serviceName = input.service;
    let serviceUrl = input.url;

    if (
      (project.type === ProjectType.FEDERATION || project.type === ProjectType.STITCHING) &&
      serviceUrl == null &&
      pushedSchema.serviceName
    ) {
      serviceUrl = pushedSchema.serviceUrl;
    }

    let schemaVersion: SchemaVersion;
    try {
      schemaVersion = await this.schemaVersions.createPublishSchemaVersion({
        graph,
        valid: composable,
        organizationId: organizationId,
        projectId: project.id,
        targetId: target.id,
        commit: input.commit,
        existingSchemaLogs: previousSchemaLogs,
        schema: input.sdl,
        author: input.author,
        previousSchemaLogId:
          publishResult.state.previousSchemas?.find(schema => schema.serviceName === serviceName)
            ?.id ?? null,
        service:
          serviceUrl && serviceName
            ? {
                name: serviceName,
                url: serviceUrl,
              }
            : null,
        serviceChanges: publishResult.state.serviceChanges ?? null,
        base_schema: baseSchema,
        metadata: input.metadata ?? null,
        schemaRevisionId: input.schemaRevisionId,
        revision: input.revision,
        github,
        actionFn: async (versionId: string) => {
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
              versionId,
            });
          }
        },
        changes,
        diffSchemaVersionId: latestComposable?.version.id ?? null,
        previousSchemaVersion: latestVersion?.version.id ?? null,
        conditionalBreakingChangeMetadata: await this.getConditionalBreakingChangeMetadata({
          conditionalBreakingChangeConfiguration,
          organizationId,
          projectId,
          targetId,
        }),
        contracts:
          publishResult.state.contracts?.map(contractResult => {
            const contract = contracts?.get(contractResult.contractId);
            invariant(contract, 'Contract should exist.');
            return this.toCreateContractVersionInput(contract, contractResult);
          }) ?? null,
        ...(fullSchemaSdl
          ? {
              compositeSchemaSDL: fullSchemaSdl,
              supergraphSDL: supergraph,
              supergraphChanges: publishResult.state.supergraphChanges ?? null,
              schemaCompositionErrors: null,
              tags: publishResult.state?.tags ?? null,
              schemaMetadata: publishResult.state?.schemaMetadata ?? null,
              metadataAttributes: publishResult.state?.metadataAttributes ?? null,
            }
          : {
              compositeSchemaSDL: null,
              supergraphSDL: null,
              supergraphChanges: null,
              schemaCompositionErrors: assertNonNull(
                publishResult.state.compositionErrors,
                "Can't be null",
              ),
              tags: null,
              schemaMetadata: null,
              metadataAttributes: null,
            }),
      });
    } catch (error: unknown) {
      if (error instanceof SchemaRevisionUnavailableError && input.revision != null) {
        return revisionNotFoundResult(input.revision);
      }
      throw error;
    }

    if (changes.length > 0 || errors.length > 0) {
      void this.alertsManager
        .triggerSchemaChangeNotifications({
          organization,
          project,
          target,
          schema: {
            id: schemaVersion.id,
            commit: input.commit,
            valid: schemaVersion.isComposable,
          },
          changes,
          messages,
          errors,
          initial,
        })
        .catch(error => {
          const errorText =
            error instanceof Error
              ? error.toString()
              : typeof error === 'string'
                ? error
                : JSON.stringify(error);
          this.logger.error('Failed to trigger schema change notifications (error=%s)', errorText);
        });
    }

    const linkToWebsite =
      typeof this.schemaModuleConfig.schemaPublishLink === 'function'
        ? this.schemaModuleConfig.schemaPublishLink({
            organization: {
              slug: organization.slug,
            },
            project: {
              slug: project.slug,
            },
            target: {
              slug: target.slug,
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
      changes: null,
      message: (publishResult.state.messages ?? []).join('\n'),
      linkToWebsite,
    };
  }

  @traceFn('SchemaPublisher.promoteSchemaVersion')
  async promoteSchemaVersion(
    args: {
      /** Where the schema version is promoted to. */
      target: Types.TargetReferenceInput;
      /** Which schema version is promoted. This can be either a target or specific schema version by id. */
      source: Types.SchemaVersionPromoteSourceInput;
    },
    signal: AbortSignal,
  ) {
    return this.internalPromoteSchemaVersionRequest(args, signal).then(
      result => {
        registryOperationOutcomeCount.inc({ operation: 'promotion', conclusion: 'success' });
        return result;
      },
      error => {
        if (error instanceof HiveError) {
          registryOperationOutcomeCount.inc({ operation: 'promotion', conclusion: 'success' });
        } else {
          registryOperationOutcomeCount.inc({ operation: 'promotion', conclusion: 'failure' });
          registryOperationUnexpectedErrorCount.inc(
            unexpectedErrorMetricLabels('promotion', error),
          );
        }
        throw error;
      },
    );
  }

  private async internalPromoteSchemaVersionRequest(
    args: {
      target: Types.TargetReferenceInput;
      source: Types.SchemaVersionPromoteSourceInput;
    },
    signal: AbortSignal,
  ) {
    this.logger.debug('Start promote schema version.');

    const selector = await this.idTranslator.resolveTargetReference({
      reference: args.target,
    });

    if (!selector) {
      this.session.raise('schemaVersion:promote');
    }

    await this.session.assertPerformAction({
      action: 'schemaVersion:promote',
      organizationId: selector.organizationId,
      params: {
        organizationId: selector.organizationId,
        projectId: selector.projectId,
        targetId: selector.targetId,
      },
    });

    trace.getActiveSpan()?.setAttributes({
      'hive.organization.id': selector.organizationId,
      'hive.target.id': selector.targetId,
      'hive.project.id': selector.projectId,
    });

    // First we resolve the source and make sure it exists within our system
    // If it does not we can fail quickly and avoid acquiring a lock that would block other
    // schema publishes etc.

    let source:
      | {
          type: 'target';
          targetId: string;
        }
      | {
          type: 'schemaVersion';
          schemaVersionId: string;
        };

    if (args.source.fromTarget) {
      const target = await this.idTranslator.resolveTargetReference({
        reference: args.source.fromTarget,
      });

      if (!target) {
        this.session.raise('schemaVersion:publish');
      }

      if (target?.projectId !== selector.projectId) {
        this.session.raise('schemaVersion:publish');
      }

      source = {
        type: 'target',
        targetId: target.targetId,
      };

      trace.getActiveSpan()?.setAttributes({
        'hive.source.type': source.type,
        'hive.source.target.id': target.targetId,
      });
    } else if (args.source.fromSchemaVersionById) {
      const project = await this.projectStore.getProject({
        organizationId: selector.organizationId,
        projectId: selector.projectId,
      });

      const result =
        await this.schemaManager.getSchemaVersionWithTargetAndGraphBySchemaVersionIdForProject(
          project,
          args.source.fromSchemaVersionById,
        );

      if (!result) {
        return {
          type: 'error' as const,
          message: 'Schema Version not found.',
        };
      }

      source = {
        type: 'schemaVersion',
        schemaVersionId: result.schemaVersion.id,
      };

      trace.getActiveSpan()?.setAttributes({
        'hive.source.type': source.type,
        'hive.source.schemaVersion.id': result.schemaVersion.id,
      });
    }

    return this.mutex
      .perform(
        registryLockId(selector.targetId),
        {
          /**
           * The global request timeout is 60 seconds.
           * We don't want to try acquiring the lock longer than 30 seconds.
           * If it succeeds after 30 seconds,
           * we have 30 seconds for actually running the business logic.
           *
           * If we would wait longer we risk the user facing 504 errors.
           */
          retries: 30,
          retryDelay: 1_000,
          signal,
        },
        async () => {
          return await this.internalPromoteSchemaVersion({
            target: selector,
            source,
          });
        },
      )
      .catch((error: unknown) => {
        if (error instanceof MutexResourceLockedError) {
          return {
            type: 'error' as const,
            message: 'Please try again later.',
          };
        }
        throw error;
      });
  }

  private diffSingleSchemaLogs(args: {
    logs: {
      target: Array<SchemaLogWithEdges>;
      origin: Array<SchemaLogWithEdges>;
    };
    target: Target;
  }): SchemaLogDiffInput {
    // we do not need to diff the services
    // the "main" diff already covers all changes
    invariant(args.logs.origin.length === 1, 'In a monolith project there can only be one log.');
    invariant(
      args.logs.target.length <= 1,
      'In a monolith project there can only be up to one log.',
    );

    return {
      removed: [],
      added: [],
      changed: [
        {
          id: args.logs.origin[0].actionId,
          previousId: args.logs.target[0]?.actionId ?? null,
          serviceName: null,
          type: 'changed',
          // there are no service specific changes
          // the changes are already covered via the main graph
          changes: null,
        },
      ],
      unchanged: [],
    };
  }

  @traceFn('SchemaPublisher.diffSchemaLogs')
  private async diffCompositeSchemaLogs(args: {
    logs: {
      target: Array<SchemaLogWithEdges>;
      origin: Array<SchemaLogWithEdges>;
    };
    target: Target;
  }): Promise<SchemaLogDiffInput> {
    this.logger.debug('produce schema log diff.');

    const diffMap = new Map<
      /* service name */ string,
      | {
          type: 'removed';
          previousLog: Schema;
        }
      | {
          type: 'unchanged';
          log: Schema;
        }
      | {
          type: 'changed';
          newLog: Schema;
          previousLog: Schema;
        }
      | {
          type: 'added';
          newLog: Schema;
        }
    >();

    for (const targetLogEdge of args.logs.target) {
      if (targetLogEdge.node.action === 'DELETE') {
        continue;
      }

      invariant(targetLogEdge.node.service_name !== null, 'A service name must exist.');

      // Note: we use fallback value of '' to support single schema workflows.
      invariant(
        diffMap.has(targetLogEdge.node.service_name) === false,
        'Invalid database state. A log for the same service can not appear more than once.',
      );

      diffMap.set(targetLogEdge.node.service_name, {
        type: 'removed',
        previousLog: targetLogEdge.node,
      });
    }

    for (const originLogEdge of args.logs.origin) {
      if (originLogEdge.node.action === 'DELETE') {
        continue;
      }

      invariant(originLogEdge.node.service_name !== null, 'A service name must exist.');

      let record = diffMap.get(originLogEdge.node.service_name);

      if (!record) {
        diffMap.set(originLogEdge.node.service_name, {
          type: 'added',
          newLog: originLogEdge.node,
        });
        continue;
      }

      invariant(record.type === 'removed', 'At this point the type can only be removed.');

      if (record.previousLog.id === originLogEdge.node.id) {
        diffMap.set(originLogEdge.node.service_name, {
          type: 'unchanged',
          log: record.previousLog,
        });
        continue;
      }

      if (record.previousLog.id !== originLogEdge.node.id) {
        diffMap.set(originLogEdge.node.service_name, {
          type: 'changed',
          newLog: originLogEdge.node,
          previousLog: record.previousLog,
        });
        continue;
      }
    }

    // At this point `diffMap` contains the full Diff of all services!
    // Let's create the new Graph version edges and delete logs (if needed)

    const schemaLogs: SchemaLogDiffInput = {
      removed: [],
      added: [],
      changed: [],
      unchanged: [],
    };

    for (const diff of diffMap.values()) {
      if (diff.type === 'removed') {
        invariant(diff.previousLog.service_name != null, 'Remove logs require a service name.');

        // Note: we seed the ID here so we do not need to map some more within the logic within `SchemaVersions.promoteSchemaVersionToTarget`
        const logId = crypto.randomUUID();
        schemaLogs.removed.push({
          id: logId,
          previousId: diff.previousLog.id,
          serviceName: diff.previousLog.service_name,
          targetId: args.target.id,
          projectId: args.target.projectId,
          type: 'removed',
        });
        continue;
      }

      if (diff.type === 'added') {
        invariant(diff.newLog.service_name != null, 'Added logs require a service name.');

        schemaLogs.added.push({
          id: diff.newLog.id,
          serviceName: diff.newLog.service_name,
          projectId: args.target.projectId,
          targetId: args.target.id,
          type: 'added',
        });
        continue;
      }

      if (diff.type === 'unchanged') {
        schemaLogs.unchanged.push({
          id: diff.log.id,
          serviceName: diff.log.service_name,
          type: 'unchanged',
        });
        continue;
      }

      if (diff.type === 'changed') {
        invariant(diff.newLog.service_name != null, 'Changed logs require a service name.');

        const changes = await this.registryChecks
          .diff({
            existingSdl: diff.previousLog.sdl ?? null,
            incomingSdl: diff.newLog.sdl ?? null,
            approvedChanges: null,
            conditionalBreakingChangeConfig: null,
            includeUrlChanges: false,
            filterOutFederationChanges: false,
            failDiffOnDangerousChange: false,
            failAllDangerousChanges: false,
            failDangerousChangeTypes: [],
            filterNestedChanges: true,
            getAffectedAppDeployments: null,
          })
          .then(r => r.result?.all ?? r.reason?.all ?? null);

        schemaLogs.changed.push({
          id: diff.newLog.id,
          previousId: diff.previousLog.id,
          serviceName: diff.newLog.service_name,
          changes,
          type: 'changed',
        });
        continue;
      }

      diff satisfies never;
      invariant(false, 'Unexpected diff type.');
    }

    this.logger.debug(
      'producing schema log diff finished (addedCount=%d, deletedCount=%d, changedCount=%d).',
      schemaLogs.added.length,
      schemaLogs.removed.length,
      schemaLogs.changed.length,
      schemaLogs.unchanged.length,
    );

    return schemaLogs;
  }

  @traceFn('SchemaPublisher.handlePromotionSchemaContracts')
  private async handlePromotionSchemaContracts(args: {
    organization: Organization;
    project: Project;
    target: Target;
    logs: {
      origin: Array<SchemaLogWithEdges>;
    };
    contractsWithLatestVersions: Array<ContractWithLatestVersions>;
  }) {
    this.logger.debug('process schema contracts for schema promotion.');

    const contracts: Array<CreateContractVersionInput> = [];

    if (!args.contractsWithLatestVersions.length) {
      this.logger.debug('no active contract definitions exist, no contracts must be computed.');
      return contracts;
    }

    this.logger.debug(
      '%d contract definitions found in target.',
      args.contractsWithLatestVersions.length,
    );

    const schemas: SchemaInput[] = [];

    for (const edge of args.logs.origin) {
      if (edge.node.action != 'PUSH' || edge.node.kind !== 'composite') {
        continue;
      }

      schemas.push({
        id: edge.node.id,
        sdl: edge.node.sdl,
        serviceName: edge.node.service_name,
        serviceUrl: edge.node.service_url,
        metadata: edge.node.metadata,
      });
    }

    const result = await this.registryChecks.composition({
      baseSchema: null,
      organization: args.organization,
      project: args.project,
      targetId: args.target.id,
      schemas,
      contracts: args.contractsWithLatestVersions.map(contract => ({
        id: contract.contract.id,
        filter: {
          removeUnreachableTypesFromPublicApiSchema:
            contract.contract.removeUnreachableTypesFromPublicApiSchema,
          exclude: contract.contract.excludeTags,
          include: contract.contract.includeTags,
        },
      })),
    });

    for (const [index, contract] of args.contractsWithLatestVersions.entries()) {
      if (result.reason) {
        contracts.push({
          changes: null,
          supergraphChanges: null,
          compositeSchemaSDL: null,
          supergraphSDL: null,
          schemaCompositionErrors: result.reason.errors,
          contractId: contract.contract.id,
          contractName: contract.contract.contractName,
          graph: contract.graph,
          diffSchemaVersionId: contract?.latestValidVersion?.id ?? null,
          previousSchemaVersionId: contract?.latestVersion?.id ?? null,
        });
        continue;
      }

      const contractResult = result?.result?.contracts?.at(index);
      invariant(!!contractResult, 'The contract at the input index must exist.');

      if (contractResult.reason) {
        contracts.push({
          changes: null,
          supergraphChanges: null,
          compositeSchemaSDL: null,
          supergraphSDL: null,
          schemaCompositionErrors: contractResult.reason.errors,
          contractId: contract.contract.id,
          contractName: contract.contract.contractName,
          graph: contract.graph,
          diffSchemaVersionId: contract?.latestValidVersion?.id ?? null,
          previousSchemaVersionId: contract?.latestVersion?.id ?? null,
        });
        continue;
      }

      const [changes, supergraphChanges] = await Promise.all([
        this.registryChecks
          .diff({
            existingSdl: contract?.latestValidVersion?.compositeSchemaSdl ?? null,
            incomingSdl: contractResult.result.fullSchemaSdl,
            conditionalBreakingChangeConfig: null,
            includeUrlChanges: false,
            filterOutFederationChanges: false,
            approvedChanges: null,
            failDiffOnDangerousChange: false,
            failAllDangerousChanges: false,
            failDangerousChangeTypes: [],
            getAffectedAppDeployments: null,
            filterNestedChanges: true,
          })
          .then(r => r.result?.all ?? r.reason?.all ?? null),
        this.registryChecks
          .diff({
            existingSdl: contract?.latestValidVersion?.supergraphSdl ?? null,
            incomingSdl: contractResult.result.supergraph,
            conditionalBreakingChangeConfig: null,
            includeUrlChanges: false,
            filterOutFederationChanges: false,
            approvedChanges: null,
            failDiffOnDangerousChange: false,
            failAllDangerousChanges: false,
            failDangerousChangeTypes: [],
            getAffectedAppDeployments: null,
            filterNestedChanges: true,
          })
          .then(r => r.result?.all ?? r.reason?.all ?? null),
      ]);

      contracts.push({
        changes,
        supergraphChanges,
        compositeSchemaSDL: contractResult.result.fullSchemaSdl,
        supergraphSDL: contractResult.result.supergraph,
        schemaCompositionErrors: null,
        contractId: contract.contract.id,
        contractName: contract.contract.contractName,
        graph: contract.graph,
        diffSchemaVersionId: contract?.latestValidVersion?.id ?? null,
        previousSchemaVersionId: contract?.latestVersion?.id ?? null,
      });
    }

    this.logger.debug(
      '%d contract(s) version diffs were successfully processed.',
      contracts.length,
    );

    return contracts;
  }

  @traceFn('SchemaPublisher.internalPromoteSchemaVersion')
  private async internalPromoteSchemaVersion(args: {
    target: {
      organizationId: string;
      projectId: string;
      targetId: string;
    };
    source:
      | {
          type: 'target';
          targetId: string;
        }
      | {
          type: 'schemaVersion';
          schemaVersionId: string;
        };
  }) {
    this.logger.debug('start schema version promotion process');
    const [organization, project, target] = await Promise.all([
      this.storage.getOrganization({ organizationId: args.target.organizationId }),
      this.projectStore.getProjectById(args.target.projectId),
      this.targetStore.getTargetById(args.target.targetId),
    ]);

    if (!organization || !target || !project) {
      this.logger.debug(
        'Could not resolve org, target or project. They might have been deleted while the lock was acquired.',
      );
      return {
        type: 'error' as const,
        message: 'Target does not exist.',
      };
    }

    const graph = await this.graphStore.getDefaultGraphForTargetId(target.id);

    let originSchemaVersionLookup: {
      target: Target;
      graph: Graph;
      schemaVersion: SchemaVersion & {
        projectId: string;
        organizationId: string;
      };
    };

    if (args.source.type === 'schemaVersion') {
      this.logger.debug(
        'use specific schema version by id as the source. (schemaVersionId=%s)',
        args.source.schemaVersionId,
      );
      const lookup =
        await this.schemaManager.getSchemaVersionWithTargetAndGraphBySchemaVersionIdForProject(
          project,
          args.source.schemaVersionId,
        );

      if (!lookup) {
        this.logger.debug(
          'the specified schema version could not be found for this project. (schemaVersionId=%s)',
          args.source.schemaVersionId,
        );
        return {
          type: 'error' as const,
          message: 'Schema Version not found.',
        };
      }

      if (lookup.graph.type === 'CONTRACT') {
        return {
          type: 'error' as const,
          message: 'A contract schema version can not be promoted.',
        };
      }

      originSchemaVersionLookup = lookup;
    } else if (args.source.type === 'target') {
      this.logger.debug('use a target as the source. (targetId=%s)', args.target.targetId);

      // If we promote within the same target, we can skip one database roundtrip and re-use the already loaded record :)
      const sourceTarget =
        args.source.targetId === target.id
          ? target
          : await this.targetStore.getTargetById(args.source.targetId);

      if (!sourceTarget) {
        this.logger.debug(
          'the source target could not be found. (targetId=%s)',
          args.source.targetId,
        );

        return {
          type: 'error' as const,
          message: 'Source target does not exist.',
        };
      }

      const sourceGraph = await this.graphStore.getDefaultGraphForTargetId(sourceTarget.id);

      const schemaVersion = await this.schemaManager.getMaybeLatestVersionForGraph(sourceGraph);

      if (!schemaVersion) {
        this.logger.debug(
          'the source target has no schema version. (targetId=%s)',
          args.source.targetId,
        );
        return {
          type: 'error' as const,
          message: 'Source target has no schema version.',
        };
      }

      this.logger.debug(
        'resolved latest schema version from source target. (targetId=%s, schemaVersionId=%s)',
        args.target.targetId,
        schemaVersion.id,
      );

      originSchemaVersionLookup = {
        target: sourceTarget,
        graph: sourceGraph,
        schemaVersion,
      };
    } else {
      throw Error(
        'INVARIANT: It seems like a new source type has been added, but not implemented.',
      );
    }

    // Here we start loading a bunch of things that we need in order to insert the new schema version

    const originTarget = originSchemaVersionLookup.target;
    const originGraph = originSchemaVersionLookup.graph;
    const originSchemaVersion = originSchemaVersionLookup.schemaVersion;

    this.logger.debug('load required data for generating new schema version.');

    const [
      targetLatestSchemaVersion,
      targetLatestValidSchemaVersion,
      originPublicSchemaSdl,
      originSupergraphSdl,
      originLogEdges,
      { conditionalBreakingChangeConfiguration },
    ] = await Promise.all([
      // The latest versions within the target we promote to
      this.schemaManager.getMaybeLatestVersionForGraph(graph),
      this.schemaManager.getMaybeLatestValidVersionForGraph(graph),
      // We have some old schema versions that do not store the SDLs on the record
      // we need to use the helpers to ensure the SDL is produced for these
      this.schemaVersionHelper.getCompositeSchemaSdl(originSchemaVersion),
      this.schemaVersionHelper.getSupergraphSdl(originSchemaVersion),
      // We need to get all the schema logs that we need to attach to the new schema version
      // we are about to create
      this.schemaVersions.getSchemaLogEdgesWithNodesForSchemaVersion(originSchemaVersion),
      this.getBreakingChangeConfiguration({
        selector: {
          targetId: target.id,
          projectId: project.id,
          organizationId: organization.id,
        },
      }),
    ]);

    const [contractsWithLatestVersions, targetLogEdges] = await Promise.all([
      project.type === ProjectType.FEDERATION
        ? this.contracts.loadActiveContractsWithLatestVersionsForGraphSchemaVersion(
            graph,
            targetLatestSchemaVersion,
          )
        : null,
      targetLatestSchemaVersion
        ? this.schemaVersions.getSchemaLogEdgesWithNodesForSchemaVersion(targetLatestSchemaVersion)
        : [],
    ]);

    // Once we loaded everything we can generate
    // - a diff between the latest schema version in the target
    //   - Subgraphs
    //   - Public SDL Changes
    //   - Supergraph SDL Changes
    //   - Contracts Changes

    this.logger.debug('compute data for new schema version.');

    const [
      schemaLogDiffs,
      publicSchemaChanges,
      supergraphSchemaChanges,
      contracts,
      conditionalBreakingChangeMetadata,
    ] = await Promise.all([
      project.type === Types.ProjectType.SINGLE
        ? this.diffSingleSchemaLogs({
            logs: {
              target: targetLogEdges,
              origin: originLogEdges,
            },
            target,
          })
        : this.diffCompositeSchemaLogs({
            logs: {
              target: targetLogEdges,
              origin: originLogEdges,
            },
            target,
          }),
      this.registryChecks
        .diff({
          existingSdl: targetLatestValidSchemaVersion?.compositeSchemaSDL ?? null,
          incomingSdl: originPublicSchemaSdl,
          conditionalBreakingChangeConfig:
            conditionalBreakingChangeConfiguration?.conditionalBreakingChangeDiffConfig ?? null,
          includeUrlChanges: false,
          filterOutFederationChanges: true,
          approvedChanges: null,
          failDiffOnDangerousChange: false,
          failAllDangerousChanges: false,
          failDangerousChangeTypes: [],
          getAffectedAppDeployments: schemaCoordinates =>
            this.appDeployments.getAffectedAppDeploymentsBySchemaCoordinates({
              targetId: target.id,
              schemaCoordinates,
              excludedAppDeploymentNames:
                conditionalBreakingChangeConfiguration?.conditionalBreakingChangeDiffConfig
                  ?.excludedAppDeploymentNames ?? null,
            }),
          filterNestedChanges: true,
        })
        .then(r => r.result?.all ?? r.reason?.all ?? null),
      this.registryChecks
        .diff({
          existingSdl: targetLatestValidSchemaVersion?.supergraphSDL ?? null,
          incomingSdl: originSupergraphSdl,
          conditionalBreakingChangeConfig: null,
          includeUrlChanges: false,
          filterOutFederationChanges: false,
          approvedChanges: null,
          failDiffOnDangerousChange: false,
          failAllDangerousChanges: false,
          failDangerousChangeTypes: [],
          getAffectedAppDeployments: null,
          filterNestedChanges: true,
        })
        .then(r => r.result?.all ?? r.reason?.all ?? null),
      this.handlePromotionSchemaContracts({
        organization,
        project,
        target,
        logs: {
          origin: originLogEdges,
        },
        contractsWithLatestVersions: contractsWithLatestVersions?.values().toArray() ?? [],
      }),
      this.getConditionalBreakingChangeMetadata({
        conditionalBreakingChangeConfiguration,
        organizationId: organization.id,
        projectId: project.id,
        targetId: target.id,
      }),
    ]);

    let meta: SchemaVersionMeta | null = originSchemaVersion.meta;

    if (!meta) {
      // in case the schema version has no "meta" field the `actionId` MUST be populated.
      const actionLog =
        originLogEdges.find(log => log.actionId === originSchemaVersion.actionId)?.node ?? null;

      if (actionLog) {
        meta = {
          author: actionLog.author,
          commit: actionLog.commit,
        };
      }
    }

    // NOTE: We re-use the values (sdl; errors; etc) from the existing origin values were possible to ensure a promotion results in the !!exact state!!
    // e.g. if we would compose from scratch but the external composition has changed a promotion would be unpredictable
    // the only exception is contracts, as the contract definitions might have changed and we might not have a contract version in the origin schema version
    const schemaVersion = await this.schemaVersions.createPromotionSchemaVersion({
      target: {
        target,
        graph,
        latestVersion: targetLatestSchemaVersion,
        latestValidVersion: targetLatestValidSchemaVersion,
      },
      origin: {
        target: originTarget,
        graph: originGraph,
        version: originSchemaVersion,
        publicSchemaSdl: originPublicSchemaSdl,
        supergraphSdl: originSupergraphSdl,
      },
      meta,
      schemaLogs: schemaLogDiffs,
      publicSchemaChanges,
      supergraphSchemaChanges,
      contracts,
      conditionalBreakingChangeMetadata,
    });

    if (schemaVersion.schemaCompositionErrors === null) {
      invariant(
        !!schemaVersion.compositeSchemaSDL,
        'A newly created schema version should always have a public schema SDL if there is no composition errors.',
      );

      this.logger.debug('update CDN state for target. (targetId=%s)', target.id);

      const publishContracts: Array<{ name: string; sdl: string; supergraph: string }> = [];
      for (const contract of contracts ?? []) {
        if (contract.compositeSchemaSDL && contract.supergraphSDL) {
          publishContracts.push({
            name: contract.contractName,
            sdl: contract.compositeSchemaSDL,
            supergraph: contract.supergraphSDL,
          });
        }
      }

      await this.publishToCDN({
        target,
        project,
        contracts: publishContracts,
        schemas: ensureCompositeSchemas(
          originLogEdges
            .map(edge => edge.node)
            .filter((node): node is Schema => node.action === 'PUSH'),
        ).map(toCompositeSchemaInput),
        fullSchemaSdl: schemaVersion.compositeSchemaSDL,
        supergraph: schemaVersion.supergraphSDL,
        versionId: schemaVersion.id,
      });
    }

    this.logger.debug(
      'successfully promoted schema version. (targetId=%s, schemaVersionId)',
      target.id,
      schemaVersion.id,
    );

    const linkToWebsite =
      typeof this.schemaModuleConfig.schemaPublishLink === 'function'
        ? this.schemaModuleConfig.schemaPublishLink({
            organization: {
              slug: organization.slug,
            },
            project: {
              slug: project.slug,
            },
            target: {
              slug: target.slug,
            },
            version: schemaVersion,
          })
        : null;

    return {
      type: 'success' as const,
      schemaVersion: {
        ...schemaVersion,
        projectId: target.projectId,
        organizationId: target.orgId,
      },
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
      slug: string;
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
      organizationId: args.project.orgId,
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
    schemaCheck,
    ...args
  }: {
    organization: Organization;
    project: {
      orgId: string;
      slug: string;
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
    contractChanges: Array<{ contractName: string; changes: Array<SchemaChangeType> }> | null;
    breakingChanges: Array<SchemaChangeType> | null;
    compositionErrors: Array<{
      message: string;
    }> | null;
    errors: Array<{
      message: string;
    }> | null;
    schemaCheckId: string | null;
    schemaCheck: SuccessfulSchemaCheckMapper | FailedSchemaCheckMapper | null;
    failedContractCompositionCount: number;
  }) {
    try {
      let title: string;
      let summary: string;
      let shortSummaryFallback: string;

      if (conclusion === SchemaCheckConclusion.Success) {
        ({ title, summary, shortSummaryFallback } = buildSchemaCheckSuccessGithubOutput({
          changes,
          contractChanges: args.contractChanges,
        }));
      } else {
        const total =
          (compositionErrors?.length ?? 0) + (breakingChanges?.length ?? 0) + (errors?.length ?? 0);

        title = `Detected ${total} error${total === 1 ? '' : 's'}`;
        summary = [
          errors ? this.errorsToMarkdown(errors) : null,
          args.failedContractCompositionCount > 0
            ? `- ${args.failedContractCompositionCount} contract check(s) failed. (Click view more details on Hive Console button below)`
            : null,
          warnings ? this.warningsToMarkdown(warnings) : null,
          compositionErrors ? this.errorsToMarkdown(compositionErrors) : null,
          breakingChanges ? this.errorsToMarkdown(breakingChanges) : null,
          changes ? changesToMarkdown(changes) : null,
        ]
          .filter(Boolean)
          .join('\n\n');

        shortSummaryFallback = [
          errors?.length ? `Errors: ${errors.length}` : null,
          warnings?.length ? `Warnings: ${warnings.length}` : null,
          compositionErrors?.length ? `Composition errors: ${compositionErrors.length}` : null,
          breakingChanges?.length ? `Breaking changes: ${breakingChanges.length}` : null,
          changes?.length ? `Changes: ${changes.length}` : null,
          args.failedContractCompositionCount > 0
            ? `Contract check failures: ${args.failedContractCompositionCount}`
            : null,
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
          summary,
          shortSummaryFallback,
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
        isValid: conclusion === SchemaCheckConclusion.Success,
        schemaCheck,
        checkRun,
      };
    } catch (error: unknown) {
      this.reportCheckRunUpdateFailure(error, {
        operation: 'check',
        organizationId: args.project.orgId,
        githubCheckRun: args.githubCheckRun,
      });
      return {
        __typename: 'GitHubSchemaCheckError' as const,
        message: 'The schema check ran, but the GitHub check-run could not be updated.',
      };
    }
  }

  @traceFn('SchemaPublisher.publishToCDN')
  private async publishToCDN({
    target,
    project,
    supergraph,
    fullSchemaSdl,
    schemas,
    contracts,
    versionId,
  }: {
    target: Target;
    project: Project;
    supergraph: string | null;
    fullSchemaSdl: string;
    schemas: readonly SchemaInput[];
    contracts: null | Array<{ name: string; supergraph: string; sdl: string }>;
    versionId: string;
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
          versionId,
        });
      }
    };

    const publishCompositeSchema = async () => {
      await Promise.all([
        this.artifactStorageWriter.writeArtifact({
          targetId: target.id,
          artifactType: 'services',
          artifact: schemas.map(s => ({
            name: s.serviceName,
            sdl: s.sdl,
            url: s.serviceUrl,
          })),
          contractName: null,
          versionId,
        }),
        this.artifactStorageWriter.writeArtifact({
          targetId: target.id,
          artifactType: 'sdl',
          artifact: fullSchemaSdl,
          contractName: null,
          versionId,
        }),
      ]);
    };

    const publishSingleSchema = async () => {
      await this.artifactStorageWriter.writeArtifact({
        targetId: target.id,
        artifactType: 'sdl',
        artifact: fullSchemaSdl,
        contractName: null,
        versionId,
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
            versionId,
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
              versionId,
            }),
            this.artifactStorageWriter.writeArtifact({
              targetId: target.id,
              artifactType: 'supergraph',
              artifact: contract.supergraph,
              contractName: contract.name,
              versionId,
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
      organizationId: args.organizationId,
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
      let shortSummaryFallback: string;

      if (valid) {
        if (initial) {
          title = 'Schema published';
          summary = 'Initial Schema published';
          shortSummaryFallback = summary;
        } else if (changes.length === 0) {
          title = 'No changes';
          summary = 'No changes detected';
          shortSummaryFallback = summary;
        } else {
          title = 'No breaking changes';
          summary = changesToMarkdown(changes);
          shortSummaryFallback = changesToMarkdown(changes, false);
        }
      } else {
        title = `Detected ${errors.length} error${errors.length === 1 ? '' : 's'}`;
        summary = [
          errors ? this.errorsToMarkdown(errors) : null,
          changes ? changesToMarkdown(changes) : null,
        ]
          .filter(Boolean)
          .join('\n\n');

        shortSummaryFallback = [
          errors ? `Errors: ${errors.length}` : null,
          changes ? `Changes: ${changes.length}` : null,
        ]
          .filter(Boolean)
          .join('\n\n');
      }

      if (messages?.length) {
        summary += `\n\n${messages.map(val => `- ${val}`).join('\n')}`;
        shortSummaryFallback += `\n\n${messages.map(val => `- ${val}`).join('\n')}`;
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
          shortSummaryFallback,
        },
        detailsUrl,
      });
      return {
        __typename: 'GitHubSchemaPublishSuccess',
        message: title,
      } as const;
    } catch (error: unknown) {
      this.reportCheckRunUpdateFailure(error, {
        operation: 'publish',
        organizationId,
        githubCheckRun,
      });
      return {
        __typename: 'GitHubSchemaPublishError',
        message: `Failed to create the check-run`,
      } as const;
    }
  }

  private reportCheckRunUpdateFailure(
    error: unknown,
    args: {
      operation: 'check' | 'publish';
      organizationId: string;
      githubCheckRun: { owner: string; repository: string; id: number };
    },
  ) {
    const contexts = {
      'GitHub Check Run': {
        organizationId: args.organizationId,
        owner: args.githubCheckRun.owner,
        repository: args.githubCheckRun.repository,
        githubCheckRunId: args.githubCheckRun.id,
      },
    };

    if (isGitHubClientError(error)) {
      this.logger.warn(
        'GitHub rejected the check-run update (operation=%s, organizationId=%s, owner=%s, repository=%s, githubCheckRunId=%s, status=%s)',
        args.operation,
        args.organizationId,
        args.githubCheckRun.owner,
        args.githubCheckRun.repository,
        args.githubCheckRun.id,
        error.status,
      );
      Sentry.captureException(error, {
        level: 'warning',
        tags: { operation: args.operation, github_status: error.status },
        contexts,
      });
      return;
    }

    Sentry.captureException(error, { tags: { operation: args.operation }, contexts });
  }

  private errorsToMarkdown(
    errors: ReadonlyArray<{ message: string; isSafeBasedOnUsage?: boolean }>,
  ): string {
    return [
      '',
      ...errors.map(
        error =>
          `- ${bolderize(error.message)}` +
          (error.isSafeBasedOnUsage ? ' (safe based on usage)' : ''),
      ),
    ].join('\n');
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
}

export type MarkdownSchemaChange = {
  criticality: CriticalityLevel;
  message: string;
  isSafeBasedOnUsage?: boolean;
  approvalMetadata?: unknown;
};

export function getSchemaCheckFailureGithubDetails(reason: SchemaCheckFailureReason) {
  const errors: Array<{ message: string }> =
    reason.schemaPolicy?.errors?.map(formatPolicyError) ?? [];

  if (reason.baselineComposition?.type === 'failure') {
    errors.push({ message: 'Baseline composition failed.' });
  }

  for (const contract of reason.contracts ?? []) {
    if (contract.baselineComposition?.type === 'failure') {
      errors.push({ message: `[${contract.contractName}] Baseline composition failed.` });
    }

    if (contract.composition.type === 'failure') {
      errors.push(
        ...contract.composition.errors.map(error => ({
          message: `[${contract.contractName}] ${error.message}`,
        })),
      );
    }

    errors.push(
      ...(contract.schemaChanges?.breaking?.map(change => ({
        message: `[${contract.contractName}] ${change.message}`,
      })) ?? []),
    );
  }

  return {
    errors,
    failedContractCompositionCount:
      reason.contracts?.filter(
        contract =>
          contract.composition.type === 'failure' ||
          contract.baselineComposition?.type === 'failure',
      ).length ?? 0,
  };
}

export function changesToMarkdown(
  changes: ReadonlyArray<MarkdownSchemaChange>,
  printListOfChanges: boolean = true,
): string {
  const breakingChanges = changes.filter(
    change => change.criticality === CriticalityLevel.Breaking,
  );
  const dangerousChanges = changes.filter(
    change => change.criticality === CriticalityLevel.Dangerous,
  );
  const safeChanges = changes.filter(change => change.criticality === CriticalityLevel.NonBreaking);

  const lines: string[] = [`## Found ${changes.length} change${changes.length > 1 ? 's' : ''}`, ''];

  if (breakingChanges.length) {
    lines.push(`Breaking: ${breakingChanges.length}`);
  }

  if (dangerousChanges.length) {
    lines.push(`Dangerous: ${dangerousChanges.length}`);
  }

  if (safeChanges.length) {
    lines.push(`Safe: ${safeChanges.length}`);
  }

  if (printListOfChanges) {
    writeChanges('Breaking', breakingChanges, lines);
    writeChanges('Dangerous', dangerousChanges, lines);
    writeChanges('Safe', safeChanges, lines);
  }

  return lines.join('\n');
}

function writeChanges(
  type: string,
  changes: ReadonlyArray<MarkdownSchemaChange>,
  lines: string[],
): void {
  if (changes.length > 0) {
    lines.push(
      ...['', `### ${type} changes`].concat(
        changes.map(change => {
          const status = change.isSafeBasedOnUsage
            ? ' (safe based on usage)'
            : change.approvalMetadata
              ? ' (approved)'
              : '';

          return ` - ${bolderize(change.message)}${status}`;
        }),
      ),
    );
  }
}

export function buildSchemaCheckSuccessGithubOutput(input: {
  changes: Array<MarkdownSchemaChange> | null;
  contractChanges: Array<{ contractName: string; changes: Array<MarkdownSchemaChange> }> | null;
}): { title: string; summary: string; shortSummaryFallback: string } {
  const coreChanges = input.changes ?? [];
  const contractChanges = input.contractChanges?.filter(contract => contract.changes.length) ?? [];

  if (coreChanges.length === 0 && contractChanges.length === 0) {
    const summary = 'No changes detected';
    return { title: 'No changes', summary, shortSummaryFallback: summary };
  }

  const buildSummary = (printListOfChanges: boolean) =>
    [
      coreChanges.length ? changesToMarkdown(coreChanges, printListOfChanges) : null,
      ...contractChanges.map(contract =>
        [
          `## Contract "${contract.contractName}"`,
          changesToMarkdown(contract.changes, printListOfChanges),
        ].join('\n'),
      ),
    ]
      .filter(Boolean)
      .join('\n\n');

  return {
    title: 'No blocking changes',
    summary: buildSummary(true),
    shortSummaryFallback: buildSummary(false),
  };
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

export function isValidServiceName(service: string): boolean {
  return service.length <= 64 && /^[a-zA-Z][\w_-]*$/g.test(service);
}
