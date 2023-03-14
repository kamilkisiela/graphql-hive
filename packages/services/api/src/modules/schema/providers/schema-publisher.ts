import { Inject, Injectable, Scope } from 'graphql-modules';
import lodash from 'lodash';
import promClient from 'prom-client';
import { Change, CriticalityLevel } from '@graphql-inspector/core';
import * as Sentry from '@sentry/node';
import type { Span } from '@sentry/types';
import * as Types from '../../../__generated__/types';
import { Project, ProjectType, Schema, Target } from '../../../shared/entities';
import { HiveError } from '../../../shared/errors';
import { bolderize } from '../../../shared/markdown';
import { sentry } from '../../../shared/sentry';
import { AlertsManager } from '../../alerts/providers/alerts-manager';
import { AuthManager } from '../../auth/providers/auth-manager';
import { TargetAccessScope } from '../../auth/providers/target-access';
import { CdnProvider } from '../../cdn/providers/cdn.provider';
import { GitHubIntegrationManager } from '../../integrations/providers/github-integration-manager';
import { OrganizationManager } from '../../organization/providers/organization-manager';
import { ProjectManager } from '../../project/providers/project-manager';
import { DistributedCache } from '../../shared/providers/distributed-cache';
import { Logger } from '../../shared/providers/logger';
import { Mutex } from '../../shared/providers/mutex';
import { Storage, type TargetSelector } from '../../shared/providers/storage';
import { TargetManager } from '../../target/providers/target-manager';
import { ArtifactStorageWriter } from './artifact-storage-writer';
import type { SchemaModuleConfig } from './config';
import { SCHEMA_MODULE_CONFIG } from './config';
import { CompositeModel } from './models/composite';
import { CompositeLegacyModel } from './models/composite-legacy';
import {
  CheckFailureReasonCode,
  DeleteFailureReasonCode,
  formatPolicyMessage,
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

const schemaCheckCount = new promClient.Counter({
  name: 'registry_check_count',
  help: 'Number of schema checks',
  labelNames: ['model', 'projectType'],
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
  TargetSelector & {
    checksum: string;
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
    private cdn: CdnProvider,
    private gitHubIntegrationManager: GitHubIntegrationManager,
    private distributedCache: DistributedCache,
    private helper: SchemaHelper,
    private artifactStorageWriter: ArtifactStorageWriter,
    private mutex: Mutex,
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

    const [target, project, organization, latestVersion, latestComposableVersion] =
      await Promise.all([
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
      ]);

    schemaCheckCount.inc({
      model: project.legacyRegistryModel ? 'legacy' : 'modern',
      projectType: project.type,
    });

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

    const modelVersion = project.legacyRegistryModel ? 'legacy' : 'modern';

    let checkResult: SchemaCheckResult;

    switch (project.type) {
      case ProjectType.SINGLE:
        this.logger.debug('Using SINGLE registry model (version=%s)', modelVersion);
        checkResult = await this.models[ProjectType.SINGLE][modelVersion].check({
          input,
          selector,
          latest: latestVersion
            ? {
                isComposable: latestVersion.valid,
                schemas: [ensureSingleSchema(latestVersion.schemas)],
              }
            : null,
          latestComposable: latestComposableVersion
            ? {
                isComposable: latestComposableVersion.valid,
                schemas: [ensureSingleSchema(latestComposableVersion.schemas)],
              }
            : null,
          baseSchema,
          project,
          organization,
        });
        break;
      case ProjectType.FEDERATION:
      case ProjectType.STITCHING:
        this.logger.debug('Using %s registry model (version=%s)', project.type, modelVersion);
        checkResult = await this.models[project.type][modelVersion].check({
          input: {
            sdl: input.sdl,
            serviceName: input.service,
          },
          selector,
          latest: latestVersion
            ? {
                isComposable: latestVersion.valid,
                schemas: ensureCompositeSchemas(latestVersion.schemas),
              }
            : null,
          latestComposable: latestComposableVersion
            ? {
                isComposable: latestComposableVersion.valid,
                schemas: ensureCompositeSchemas(latestComposableVersion.schemas),
              }
            : null,
          baseSchema,
          project,
          organization,
        });
        break;
      default:
        throw new HiveError(`${project.type} project (${modelVersion}) not supported`);
    }

    if (input.github) {
      if (checkResult.conclusion === SchemaCheckConclusion.Success) {
        return this.githubCheck({
          project,
          target,
          serviceName: input.service ?? null,
          sha: input.github.commit,
          conclusion: checkResult.conclusion,
          changes: checkResult.state.changes ?? null,
          warnings: checkResult.state.warnings,
          breakingChanges: null,
          compositionErrors: null,
          errors: null,
        });
      }

      return this.githubCheck({
        project,
        target,
        serviceName: input.service ?? null,
        sha: input.github.commit,
        conclusion: checkResult.conclusion,
        changes:
          getReasonByCode(checkResult, CheckFailureReasonCode.BreakingChanges)?.changes ?? null,
        breakingChanges:
          getReasonByCode(checkResult, CheckFailureReasonCode.BreakingChanges)?.breakingChanges ??
          null,
        compositionErrors:
          getReasonByCode(checkResult, CheckFailureReasonCode.CompositionFailure)
            ?.compositionErrors ?? null,
        warnings: checkResult.warnings ?? [],
        errors: (
          [] as Array<{
            message: string;
          }>
        ).concat(
          getReasonByCode(checkResult, CheckFailureReasonCode.MissingServiceName)
            ? [
                {
                  message: 'Missing service name',
                },
              ]
            : [],
          getReasonByCode(checkResult, CheckFailureReasonCode.PolicyInfringement)?.errors.map(
            e => ({ message: formatPolicyMessage(e) }),
          ) ?? [],
        ),
      });
    }

    if (checkResult.conclusion === SchemaCheckConclusion.Success) {
      return {
        __typename: 'SchemaCheckSuccess',
        valid: true,
        changes: checkResult.state.changes ?? [],
        warnings: checkResult.state.warnings ?? [],
        initial: checkResult.state.initial,
      } as const;
    }

    return {
      __typename: 'SchemaCheckError',
      valid: false,
      changes: getReasonByCode(checkResult, CheckFailureReasonCode.BreakingChanges)?.changes ?? [],
      warnings: checkResult.warnings ?? [],
      errors: (
        [] as Array<{
          message: string;
        }>
      ).concat(
        getReasonByCode(checkResult, CheckFailureReasonCode.MissingServiceName)
          ? [
              {
                message: 'Missing service name',
              },
            ]
          : [],
        getReasonByCode(checkResult, CheckFailureReasonCode.BreakingChanges)?.breakingChanges ?? [],
        getReasonByCode(checkResult, CheckFailureReasonCode.PolicyInfringement)?.errors.map(e => ({
          message: formatPolicyMessage(e),
        })) ?? [],
        getReasonByCode(checkResult, CheckFailureReasonCode.CompositionFailure)
          ?.compositionErrors ?? [],
      ),
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

    if (updateResult.valid === true) {
      // Now, when fetching the latest valid version, we should be able to detect
      // if it's the version we just updated or not.
      // Why?
      // Because we change its status to valid
      // and `getLatestValidVersion` calls for fresh data from DB
      const latestVersion = await this.schemaManager.getLatestValidVersion(input);

      // if it is the latest version, we should update the CDN
      if (latestVersion.id === updateResult.id) {
        this.logger.info('Version is now promoted to latest valid (version=%s)', latestVersion.id);
        const [project, target, schemas] = await Promise.all([
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
        const compositionResult = await orchestrator.composeAndValidate(
          schemaObjects,
          project.externalComposition,
        );

        this.logger.info(
          'Deploying version to CDN (reason="status_change" version=%s)',
          latestVersion.id,
        );

        await this.updateCDN({
          target,
          project,
          supergraph: compositionResult.supergraph,
          schemas,
          fullSchemaSdl: compositionResult.sdl!,
        });
      }
    }

    return updateResult;
  }

  @sentry('SchemaPublisher.delete')
  async delete(input: DeleteInput, signal: AbortSignal) {
    this.logger.info('Deleting schema (input=%o)', input);

    return this.mutex.perform(
      registryLockId(input.target),
      {
        signal,
      },
      async () => {
        await this.authManager.ensureTargetAccess({
          organization: input.organization,
          project: input.project,
          target: input.target,
          scope: TargetAccessScope.REGISTRY_WRITE,
        });
        const [project, organization, latestVersion, latestComposableVersion, baseSchema] =
          await Promise.all([
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
            this.schemaManager.getBaseSchema({
              organization: input.organization,
              project: input.project,
              target: input.target,
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

        const deleteResult = await this.models[project.type][modelVersion].delete({
          input: {
            serviceName: input.serviceName,
          },
          latest: {
            isComposable: latestVersion.valid,
            schemas,
          },
          latestComposable: latestComposableVersion
            ? {
                isComposable: latestComposableVersion.valid,
                schemas: ensureCompositeSchemas(latestComposableVersion.schemas),
              }
            : null,
          baseSchema,
          project,
          organization,
          selector: {
            target: input.target,
            project: input.project,
            organization: input.organization,
          },
        });

        if (deleteResult.conclusion === SchemaDeleteConclusion.Accept) {
          this.logger.debug('Delete accepted');
          if (input.dryRun !== true) {
            await this.storage.deleteSchema({
              organization: input.organization,
              project: input.project,
              target: input.target,
              serviceName: input.serviceName,
              composable: deleteResult.state.composable,
            });
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
          deleteResult,
          DeleteFailureReasonCode.CompositionFailure,
        )?.compositionErrors;

        if (getReasonByCode(deleteResult, DeleteFailureReasonCode.MissingServiceName)) {
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

    const [organization, project, target, latestVersion, latestComposable, baseSchema] =
      await Promise.all([
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
      ]);

    schemaPublishCount.inc({
      model: project.legacyRegistryModel ? 'legacy' : 'modern',
      projectType: project.type,
    });

    await this.schemaManager.completeGetStartedCheck({
      organization: project.orgId,
      step: 'publishingSchema',
    });

    this.logger.debug(`Found ${latestVersion?.schemas.length ?? 0} most recent schemas`);

    const modelVersion = project.legacyRegistryModel ? 'legacy' : 'modern';

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
                schemas: [ensureSingleSchema(latestVersion.schemas)],
              }
            : null,
          latestComposable: latestComposable
            ? {
                isComposable: latestComposable.valid,
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
                schemas: ensureCompositeSchemas(latestVersion.schemas),
              }
            : null,
          latestComposable: latestComposable
            ? {
                isComposable: latestComposable.valid,
                schemas: ensureCompositeSchemas(latestComposable.schemas),
              }
            : null,
          organization,
          project,
          target,
          baseSchema,
        });
        break;
      default:
        throw new HiveError(`${project.type} project (${modelVersion}) not supported`);
    }

    if (publishResult.conclusion === SchemaPublishConclusion.Ignore) {
      this.logger.debug('Publish ignored (reasons=%s)', publishResult.reason);

      schemaPublishCount.inc({
        model: modelVersion,
        projectType: project.type,
        conclusion: 'ignored',
      });

      if (input.github) {
        return this.createPublishCheckRun({
          force: false,
          initial: false,
          input,
          project,
          valid: true,
          changes: [],
          errors: [],
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
              version: latestVersion ? { id: latestVersion.version } : undefined,
            })
          : null;

      return {
        __typename: 'SchemaPublishSuccess' as const,
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

      schemaPublishCount.inc({
        model: modelVersion,
        projectType: project.type,
        conclusion: 'rejected',
      });

      if (getReasonByCode(publishResult, PublishFailureReasonCode.MissingServiceName)) {
        return {
          __typename: 'SchemaPublishMissingServiceError' as const,
          message: 'Missing service name',
        } as const;
      }

      if (getReasonByCode(publishResult, PublishFailureReasonCode.MissingServiceUrl)) {
        return {
          __typename: 'SchemaPublishMissingUrlError' as const,
          message: 'Missing service url',
        } as const;
      }

      return {
        __typename: 'SchemaPublishError' as const,
        valid: false,
        changes:
          getReasonByCode(publishResult, PublishFailureReasonCode.BreakingChanges)?.changes ?? [],
        errors: (
          [] as Array<{
            message: string;
          }>
        ).concat(
          getReasonByCode(publishResult, PublishFailureReasonCode.BreakingChanges)?.changes ?? [],
          getReasonByCode(publishResult, PublishFailureReasonCode.CompositionFailure)
            ?.compositionErrors ?? [],
          getReasonByCode(publishResult, PublishFailureReasonCode.MetadataParsingFailure)
            ? [
                {
                  message: 'Failed to parse metadata',
                },
              ]
            : [],
        ),
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

    schemaPublishCount.inc({
      model: modelVersion,
      projectType: project.type,
      conclusion: 'accepted',
    });

    const composable = publishResult.state.composable;
    const fullSchemaSdl = publishResult.state.fullSchemaSdl;

    if (composable && !fullSchemaSdl) {
      throw new Error('Version is composable but the full schema SDL is missing');
    }

    const changes = publishResult.state.changes ?? [];
    const messages = publishResult.state.messages ?? [];
    const initial = publishResult.state.initial;
    const pushedSchema = publishResult.state.schema;
    const schemas = [...publishResult.state.schemas];
    const schemaLogIds = schemas
      .filter(s => s.id !== pushedSchema.id) // do not include the incoming schema
      .map(s => s.id);

    const supergraph = publishResult.state.supergraph ?? null;

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
      actionFn: async () => {
        if (composable && fullSchemaSdl) {
          await this.publishToCDN({
            target,
            project,
            supergraph,
            fullSchemaSdl,
            schemas,
          });
        }
      },
      changes,
      previousSchemaVersion: latestVersion?.version ?? null,
      ...(fullSchemaSdl
        ? {
            compositeSchemaSDL: fullSchemaSdl,
            schemaCompositionErrors: null,
          }
        : {
            compositeSchemaSDL: null,
            schemaCompositionErrors: assertNonNull(
              publishResult.state.compositionErrors,
              "Can't be null",
            ),
          }),
    });

    if (changes.length > 0 || errors.length > 0) {
      void this.alertsManager
        .triggerSchemaChangeNotifications({
          organization,
          project,
          target,
          schema: schemaVersion,
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

    if (input.github) {
      return this.createPublishCheckRun({
        force: false,
        initial: publishResult.state.initial,
        input,
        project,
        valid: publishResult.state.composable,
        changes: publishResult.state.changes ?? [],
        errors,
        messages: publishResult.state.messages ?? [],
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

  private async githubCheck({
    project,
    target,
    serviceName,
    sha,
    conclusion,
    changes,
    breakingChanges,
    compositionErrors,
    errors,
    warnings,
  }: {
    project: Project;
    target: Target;
    serviceName: string | null;
    sha: string;
    conclusion: SchemaCheckConclusion;
    warnings: SchemaCheckWarning[] | null;
    changes: Array<Change> | null;
    breakingChanges: Array<Change> | null;
    compositionErrors: Array<{
      message: string;
    }> | null;
    errors: Array<{
      message: string;
    }> | null;
  }) {
    if (!project.gitRepository) {
      return {
        __typename: 'GitHubSchemaCheckError' as const,
        message: 'Git repository is not configured for this project',
      };
    }
    const [repositoryOwner, repositoryName] = project.gitRepository.split('/');

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
          warnings ? this.warningsToMarkdown(warnings) : null,
          compositionErrors ? this.errorsToMarkdown(compositionErrors) : null,
          breakingChanges ? this.errorsToMarkdown(breakingChanges) : null,
          changes ? this.changesToMarkdown(changes) : null,
        ]
          .filter(Boolean)
          .join('\n\n');
      }

      await this.gitHubIntegrationManager.createCheckRun({
        name: buildGitHubActionCheckName(target.name, serviceName ?? null),
        conclusion: conclusion === SchemaCheckConclusion.Success ? 'success' : 'failure',
        sha,
        organization: project.orgId,
        repositoryOwner,
        repositoryName,
        output: {
          title,
          summary,
        },
      });

      return {
        __typename: 'GitHubSchemaCheckSuccess' as const,
        message: 'Check-run created',
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
  }: {
    target: Target;
    project: Project;
    supergraph: string | null;
    fullSchemaSdl: string;
    schemas: readonly Schema[];
  }) {
    await this.updateCDN({
      target,
      project,
      schemas,
      supergraph,
      fullSchemaSdl,
    });
  }

  private async updateCDN(
    {
      target,
      project,
      supergraph,
      schemas,
      fullSchemaSdl,
    }: {
      target: Target;
      project: Project;
      schemas: readonly Schema[];
      supergraph?: string | null;
      fullSchemaSdl: string;
    },
    span?: Span,
  ) {
    const publishMetadata = async () => {
      const metadata: Array<Record<string, any>> = [];
      for (const schema of schemas) {
        if (typeof schema.metadata === 'string') {
          metadata.push(JSON.parse(schema.metadata));
        }
      }
      if (metadata.length > 0) {
        await Promise.all([
          this.artifactStorageWriter.writeArtifact({
            targetId: target.id,
            artifact: metadata,
            artifactType: 'metadata',
          }),
          this.cdn.publish(
            {
              targetId: target.id,
              resourceType: 'metadata',
              value: JSON.stringify(metadata.length === 1 ? metadata[0] : metadata),
            },
            span,
          ),
        ]);
      }
    };

    const publishCompositeSchema = async () => {
      const compositeSchema = ensureCompositeSchemas(schemas);

      await Promise.all([
        this.artifactStorageWriter.writeArtifact({
          targetId: target.id,
          artifactType: 'services',
          artifact: compositeSchema.map(s => ({
            name: s.service_name,
            sdl: s.sdl,
            url: s.service_url,
          })),
        }),
        this.artifactStorageWriter.writeArtifact({
          targetId: target.id,
          artifactType: 'sdl',
          artifact: fullSchemaSdl,
        }),
        this.cdn.publish(
          {
            targetId: target.id,
            resourceType: 'schema',
            value: JSON.stringify(
              schemas.length > 1
                ? compositeSchema.map(s => ({
                    sdl: s.sdl,
                    url: s.service_url,
                    name: s.service_name,
                    date: s.date,
                  }))
                : {
                    sdl: compositeSchema[0].sdl,
                    url: compositeSchema[0].service_url,
                    name: compositeSchema[0].service_name,
                    date: compositeSchema[0].date,
                  },
            ),
          },
          span,
        ),
      ]);
    };

    const publishSingleSchema = async () => {
      await Promise.all([
        this.artifactStorageWriter.writeArtifact({
          targetId: target.id,
          artifactType: 'sdl',
          artifact: fullSchemaSdl,
        }),
        this.cdn.publish(
          {
            targetId: target.id,
            resourceType: 'schema',
            value: JSON.stringify({
              sdl: schemas[0].sdl,
              date: schemas[0].date,
            }),
          },
          span,
        ),
      ]);
    };

    const actions = [
      project.type === ProjectType.SINGLE ? publishSingleSchema() : publishCompositeSchema(),
      publishMetadata(),
    ];

    if (project.type === ProjectType.FEDERATION) {
      if (supergraph) {
        this.logger.debug('Publishing supergraph to CDN');

        actions.push(
          this.cdn.publish(
            {
              targetId: target.id,
              resourceType: 'supergraph',
              value: supergraph,
            },
            span,
          ),
          this.artifactStorageWriter.writeArtifact({
            targetId: target.id,
            artifactType: 'supergraph',
            artifact: supergraph,
          }),
        );
      }
    }

    await Promise.all(actions);
  }

  private async createPublishCheckRun({
    initial,
    force,
    input,
    project,
    valid,
    changes,
    errors,
    messages,
  }: {
    initial: boolean;
    force?: boolean | null;
    input: PublishInput;
    project: Project;
    valid: boolean;
    changes: Array<Change>;
    errors: readonly Types.SchemaError[];
    messages?: string[];
  }) {
    if (!project.gitRepository) {
      return {
        __typename: 'GitHubSchemaPublishError' as const,
        message: 'Git repository is not configured for this project',
      };
    }
    const [repositoryOwner, repositoryName] = project.gitRepository.split('/');

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

      await this.gitHubIntegrationManager.createCheckRun({
        name: 'GraphQL Hive - schema:publish',
        conclusion: valid ? 'success' : force ? 'neutral' : 'failure',
        sha: input.commit,
        organization: input.organization,
        repositoryOwner,
        repositoryName,
        output: {
          title,
          summary,
        },
      });
      return {
        __typename: 'GitHubSchemaPublishSuccess' as const,
        message: title,
      };
    } catch (error: any) {
      Sentry.captureException(error);
      return {
        __typename: 'GitHubSchemaPublishError' as const,
        message: `Failed to create the check-run`,
      };
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

  private changesToMarkdown(changes: ReadonlyArray<Change>): string {
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
  return (change: Change) => change.criticality.level === level;
}

function writeChanges(type: string, changes: ReadonlyArray<Change>, lines: string[]): void {
  if (changes.length > 0) {
    lines.push(
      ...['', `### ${type} changes`].concat(
        changes.map(change => ` - ${bolderize(change.message)}`),
      ),
    );
  }
}

function buildGitHubActionCheckName(target: string, service: string | null) {
  return `GraphQL Hive > schema:check > ${target}` + (service ? ` > ${service}` : '');
}
