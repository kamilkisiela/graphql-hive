import * as Sentry from '@sentry/node';
import type { Span } from '@sentry/types';
import { Inject, Injectable, Scope } from 'graphql-modules';
import lodash from 'lodash';
import * as Types from '../../../__generated__/types';
import { Orchestrator, Project, ProjectType, Schema, Target } from '../../../shared/entities';
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
import { IdempotentRunner } from '../../shared/providers/idempotent-runner';
import { Logger } from '../../shared/providers/logger';
import { type TargetSelector, Storage } from '../../shared/providers/storage';
import { TargetManager } from '../../target/providers/target-manager';
import { ArtifactStorageWriter } from './artifact-storage-writer';
import type { SchemaModuleConfig } from './config';
import { SCHEMA_MODULE_CONFIG } from './config';
import { FederationModel } from './models/federation';
import { FederationLegacyModel } from './models/federation-legacy';
import {
  CheckFailureReasonCode,
  getReasonByCode,
  PublishFailureReasonCode,
  SchemaCheckConclusion,
  SchemaPublishConclusion,
} from './models/shared';
import { SingleModel } from './models/single';
import { SingleLegacyModel } from './models/single-legacy';
import { StitchingModel } from './models/stitching';
import { StitchingLegacyModel } from './models/stitching-legacy';
import { ensureCompositeSchemas, ensureSingleSchema, SchemaHelper } from './schema-helper';
import { SchemaManager } from './schema-manager';

export type CheckInput = Omit<Types.SchemaCheckInput, 'project' | 'organization' | 'target'> &
  TargetSelector;

export type PublishInput = Types.SchemaPublishInput &
  TargetSelector & {
    checksum: string;
    isSchemaPublishMissingUrlErrorSelected: boolean;
  };

type BreakPromise<T> = T extends Promise<infer U> ? U : never;

type PublishResult = BreakPromise<ReturnType<SchemaPublisher['internalPublish']>>;

@Injectable({
  scope: Scope.Operation,
})
export class SchemaPublisher {
  private logger: Logger;

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
    private idempotentRunner: IdempotentRunner,
    private helper: SchemaHelper,
    private artifactStorageWriter: ArtifactStorageWriter,
    private federationModel: FederationModel,
    private federationLegacyModel: FederationLegacyModel,
    private singleModel: SingleModel,
    private singleLegacyModel: SingleLegacyModel,
    private stitchingModel: StitchingModel,
    private stitchingLegacyModel: StitchingLegacyModel,
    @Inject(SCHEMA_MODULE_CONFIG) private schemaModuleConfig: SchemaModuleConfig,
  ) {
    this.logger = logger.child({ service: 'SchemaPublisher' });
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

    const [project, latestVersion] = await Promise.all([
      this.projectManager.getProject({
        organization: input.organization,
        project: input.project,
      }),
      this.schemaManager.getLatestSchemas({
        organization: input.organization,
        project: input.project,
        target: input.target,
      }),
    ]);

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

    const mode: 'legacy' | 'modern' = project.legacyRegistryModel ? 'legacy' : 'modern';

    const runCheck = () => {
      switch (`${project.type}:${mode}` as const) {
        case `${ProjectType.SINGLE}:modern`:
          return this.singleModel.check({
            input,
            selector,
            latest:
              'version' in latestVersion
                ? {
                    isComposable: latestVersion.valid,
                    schemas: [ensureSingleSchema(latestVersion.schemas)],
                  }
                : null,
            baseSchema,
            project,
          });
        case `${ProjectType.FEDERATION}:modern`:
          return this.federationModel.check({
            input: {
              sdl: input.sdl,
              serviceName: input.service,
            },
            selector,
            latest:
              'version' in latestVersion
                ? {
                    isComposable: latestVersion.valid,
                    schemas: ensureCompositeSchemas(latestVersion.schemas),
                  }
                : null,
            baseSchema,
            project,
          });
        case `${ProjectType.STITCHING}:modern`:
          return this.stitchingModel.check({
            input: {
              sdl: input.sdl,
              serviceName: input.service,
            },
            selector,
            latest:
              'version' in latestVersion
                ? {
                    isComposable: latestVersion.valid,
                    schemas: ensureCompositeSchemas(latestVersion.schemas),
                  }
                : null,
            baseSchema,
            project,
          });
        case `${ProjectType.SINGLE}:legacy`:
          return this.singleLegacyModel.check({
            input: {
              sdl: input.sdl,
            },
            selector,
            latest:
              'version' in latestVersion
                ? {
                    isComposable: latestVersion.valid,
                    schemas: [ensureSingleSchema(latestVersion.schemas)],
                  }
                : null,
            baseSchema,
            project,
          });
        case `${ProjectType.FEDERATION}:legacy`:
          return this.federationLegacyModel.check({
            input: {
              sdl: input.sdl,
              serviceName: input.service,
            },
            selector,
            latest:
              'version' in latestVersion
                ? {
                    isComposable: latestVersion.valid,
                    schemas: ensureCompositeSchemas(latestVersion.schemas),
                  }
                : null,
            baseSchema,
            project,
          });
        case `${ProjectType.STITCHING}:legacy`:
          return this.stitchingLegacyModel.check({
            input: {
              sdl: input.sdl,
              serviceName: input.service,
            },
            selector,
            latest:
              'version' in latestVersion
                ? {
                    isComposable: latestVersion.valid,
                    schemas: ensureCompositeSchemas(latestVersion.schemas),
                  }
                : null,
            baseSchema,
            project,
          });
        default:
          throw new HiveError(`${project.type} project (${mode}) not supported`);
      }
    };

    const checkResult = await runCheck();

    if (input.github) {
      if (checkResult.conclusion === SchemaCheckConclusion.Success) {
        return this.githubCheck({
          project,
          sha: input.github.commit,
          conclusion: checkResult.conclusion,
          changes: checkResult.state.changes ?? null,
          breakingChanges: null,
          compositionErrors: null,
          errors: null,
        });
      }
      return this.githubCheck({
        project,
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
        ),
      });
    }

    if (checkResult.conclusion === SchemaCheckConclusion.Success) {
      return {
        __typename: 'SchemaCheckSuccess' as const,
        valid: true,
        changes: checkResult.state.changes ?? [],
        initial: checkResult.state.initial,
      } satisfies Types.ResolversTypes['SchemaCheckSuccess'];
    }

    return {
      __typename: 'SchemaCheckError' as const,
      valid: false,
      changes: getReasonByCode(checkResult, CheckFailureReasonCode.BreakingChanges)?.changes ?? [],
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
        getReasonByCode(checkResult, CheckFailureReasonCode.CompositionFailure)
          ?.compositionErrors ?? [],
      ),
    } satisfies Types.ResolversTypes['SchemaCheckError'];
  }

  async githubCheck({
    project,
    sha,
    conclusion,
    changes,
    breakingChanges,
    compositionErrors,
    errors,
  }: {
    project: Project;
    sha: string;
    conclusion: SchemaCheckConclusion;
    changes: Types.SchemaChange[] | null;
    breakingChanges: Array<{
      message: string;
    }> | null;
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
          compositionErrors ? this.errorsToMarkdown(compositionErrors) : null,
          breakingChanges ? this.errorsToMarkdown(breakingChanges) : null,
          changes ? this.changesToMarkdown(changes) : null,
        ]
          .filter(Boolean)
          .join('\n\n');
      }

      await this.gitHubIntegrationManager.createCheckRun({
        name: 'GraphQL Hive - schema:check',
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

  @sentry('SchemaPublisher.publish')
  async publish(
    input: PublishInput,
    signal: AbortSignal,
    span?: Span | undefined,
  ): Promise<PublishResult> {
    this.logger.debug('Schema publication (checksum=%s)', input.checksum);
    return this.idempotentRunner.run({
      identifier: `schema:publish:${input.checksum}`,
      executor: async () => {
        const unlock = await this.storage.idMutex.lock(`schema:publish:${input.target}`, {
          signal,
        });
        try {
          return await this.internalPublish(input);
        } finally {
          await unlock();
        }
      },
      ttl: 60,
      span,
    });
  }

  @sentry('SchemaPublisher.sync')
  public async sync(selector: TargetSelector, span?: Span) {
    this.logger.info('Syncing CDN with DB (target=%s)', selector.target);
    await this.authManager.ensureTargetAccess({
      target: selector.target,
      project: selector.project,
      organization: selector.organization,
      scope: TargetAccessScope.REGISTRY_WRITE,
    });
    try {
      const [latestVersion, project, target] = await Promise.all([
        this.schemaManager.getLatestValidVersion(selector),
        this.projectManager.getProject({
          organization: selector.organization,
          project: selector.project,
        }),
        this.targetManager.getTarget({
          organization: selector.organization,
          project: selector.project,
          target: selector.target,
        }),
      ]);

      const schemas = await this.schemaManager.getSchemasOfVersion({
        organization: selector.organization,
        project: selector.project,
        target: selector.target,
        version: latestVersion.id,
        includeMetadata: true,
      });

      const orchestrator = this.schemaManager.matchOrchestrator(project.type);
      const schemaObjects = schemas.map(s => this.helper.createSchemaObject(s));
      const schema = await orchestrator.build(schemaObjects, project.externalComposition);

      this.logger.info('Deploying version to CDN (reason="sync", version=%s)', latestVersion.id);

      await this.updateCDN(
        {
          target,
          project,
          supergraph:
            project.type === ProjectType.FEDERATION
              ? await orchestrator.supergraph(schemaObjects, project.externalComposition)
              : null,
          schemas,
          fullSchemaSdl: schema.raw,
        },
        span,
      );
    } catch (error) {
      this.logger.error(`Failed to sync with CDN ` + String(error), error);
      throw error;
    }
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
        const schema = await orchestrator.build(schemaObjects, project.externalComposition);

        this.logger.info(
          'Deploying version to CDN (reason="status_change" version=%s)',
          latestVersion.id,
        );

        await this.updateCDN({
          target,
          project,
          supergraph:
            project.type === ProjectType.FEDERATION
              ? await orchestrator.supergraph(
                  schemas.map(s => this.helper.createSchemaObject(s)),
                  project.externalComposition,
                )
              : null,
          schemas,
          fullSchemaSdl: schema.raw,
        });
      }
    }

    return updateResult;
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
      metadata: Boolean(input.metadata),
    });

    await this.authManager.ensureTargetAccess({
      target: targetId,
      project: projectId,
      organization: organizationId,
      scope: TargetAccessScope.REGISTRY_WRITE,
    });

    const [organization, project, target, latestVersion, baseSchema] = await Promise.all([
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
        // here we get an empty list of schemas
        organization: organizationId,
        project: projectId,
        target: targetId,
      }),
      this.schemaManager.getBaseSchema({
        organization: organizationId,
        project: projectId,
        target: targetId,
      }),
    ]);

    // const schemas = latest.schemas;

    await this.schemaManager.completeGetStartedCheck({
      organization: project.orgId,
      step: 'publishingSchema',
    });

    this.logger.debug(`Found ${latestVersion.schemas.length} most recent schemas`);

    const mode: 'legacy' | 'modern' = project.legacyRegistryModel ? 'legacy' : 'modern';

    const runPublish = () => {
      switch (`${project.type}:${mode}` as const) {
        case `${ProjectType.SINGLE}:modern`:
          return this.singleModel.publish({
            input,
            latest:
              'version' in latestVersion
                ? {
                    isComposable: latestVersion.valid,
                    schemas: [ensureSingleSchema(latestVersion.schemas)],
                  }
                : null,
            project,
            target,
            baseSchema,
          });
        case `${ProjectType.FEDERATION}:modern`:
          this.logger.debug('Using Federation model');
          return this.federationModel.publish({
            input,
            latest:
              'version' in latestVersion
                ? {
                    isComposable: latestVersion.valid,
                    schemas: ensureCompositeSchemas(latestVersion.schemas),
                  }
                : null,
            project,
            target,
          });
        case `${ProjectType.STITCHING}:modern`:
          return this.stitchingModel.publish({
            input,
            latest:
              'version' in latestVersion
                ? {
                    isComposable: latestVersion.valid,
                    schemas: ensureCompositeSchemas(latestVersion.schemas),
                  }
                : null,
            project,
            target,
          });
        case `${ProjectType.SINGLE}:legacy`:
          this.logger.debug('Using Single (legacy) model');
          return this.singleLegacyModel.publish({
            input,
            latest:
              'version' in latestVersion
                ? {
                    isComposable: latestVersion.valid,
                    schemas: [ensureSingleSchema(latestVersion.schemas)],
                  }
                : null,
            project,
            target,
            baseSchema,
          });
        case `${ProjectType.FEDERATION}:legacy`:
          this.logger.debug('Using Federation (legacy) model');
          return this.federationLegacyModel.publish({
            input,
            latest:
              'version' in latestVersion
                ? {
                    isComposable: latestVersion.valid,
                    schemas: ensureCompositeSchemas(latestVersion.schemas),
                  }
                : null,
            project,
            target,
          });
        case `${ProjectType.STITCHING}:legacy`:
          this.logger.debug('Using Stitching (legacy) model');
          return this.stitchingLegacyModel.publish({
            input,
            latest:
              'version' in latestVersion
                ? {
                    isComposable: latestVersion.valid,
                    schemas: ensureCompositeSchemas(latestVersion.schemas),
                  }
                : null,
            project,
            target,
          });
        default:
          throw new HiveError(`${project.type} project (${mode}) not supported`);
      }
    };

    const publishResult = await runPublish();

    if (publishResult.conclusion === SchemaPublishConclusion.Ignore) {
      this.logger.debug('Publish ignored (reasons=%s)', publishResult.reason);
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

      return {
        __typename: 'SchemaPublishSuccess' as const,
        initial: false,
        valid: true,
        changes: [],
      } satisfies Types.ResolversTypes['SchemaPublishSuccess'];
    }

    if (publishResult.conclusion === SchemaPublishConclusion.Reject) {
      this.logger.debug(
        'Publish rejected (reasons=%s)',
        publishResult.reasons.map(r => r.code).join(', '),
      );
      if (getReasonByCode(publishResult, PublishFailureReasonCode.MissingServiceName)) {
        return {
          __typename: 'SchemaPublishMissingServiceError' as const,
          message: 'Missing service name',
        } satisfies Types.ResolversTypes['SchemaPublishMissingServiceError'];
      }

      if (getReasonByCode(publishResult, PublishFailureReasonCode.MissingServiceUrl)) {
        return {
          __typename: 'SchemaPublishMissingUrlError' as const,
          message: 'Missing service url',
        } satisfies Types.ResolversTypes['SchemaPublishMissingUrlError'];
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
      } satisfies Types.ResolversTypes['SchemaPublishError'];
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

    const newVersion = await this.publishNewVersion({
      input,
      valid: publishResult.state.composable,
      schemas: publishResult.state.schemas,
      newSchema: publishResult.state.schema,
      organizationId,
      target,
      project,
      changes: publishResult.state.changes ?? [],
      errors,
      initial: publishResult.state.initial,
    });

    await this.publishToCDN({
      valid: newVersion.valid,
      target,
      project,
      orchestrator: publishResult.state.orchestrator,
      schemas: publishResult.state.schemas,
    });

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
            version: 'version' in latestVersion ? newVersion : undefined,
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
      changes: publishResult.state.changes ?? [],
      message: (publishResult.state.messages ?? []).join('\n'),
      linkToWebsite,
    } satisfies Types.ResolversTypes['SchemaPublishSuccess'];
  }

  @sentry('SchemaPublisher.publishNewVersion')
  private async publishNewVersion({
    valid,
    input,
    target,
    project,
    organizationId,
    newSchema,
    schemas,
    changes,
    errors,
    initial,
  }: {
    valid: boolean;
    input: PublishInput;
    target: Target;
    project: Project;
    organizationId: string;
    newSchema: Schema;
    schemas: readonly Schema[];
    changes: Types.SchemaChange[];
    errors: Types.SchemaError[];
    initial: boolean;
  }) {
    const commits = schemas
      .filter(s => s.id !== newSchema.id) // do not include the incoming schema
      .map(s => s.id);

    this.logger.debug(`Assigning ${commits.length} schemas to new version`);
    const baseSchema = await this.schemaManager.getBaseSchema({
      organization: input.organization,
      project: input.project,
      target: input.target,
    });
    const [schemaVersion, organization] = await Promise.all([
      this.schemaManager.createVersion({
        valid,
        organization: organizationId,
        project: project.id,
        target: target.id,
        commit: input.commit,
        commits,
        service: input.service,
        schema: input.sdl,
        author: input.author,
        url: input.url,
        base_schema: baseSchema,
        metadata: input.metadata ?? null,
      }),
      this.organizationManager.getOrganization({
        organization: organizationId,
      }),
    ]);

    void this.alertsManager
      .triggerSchemaChangeNotifications({
        organization,
        project,
        target,
        schema: schemaVersion,
        changes,
        errors,
        initial,
      })
      .catch(err => {
        this.logger.error('Failed to trigger schema change notifications', err);
      });

    return schemaVersion;
  }

  @sentry('SchemaPublisher.publishToCDN')
  private async publishToCDN({
    valid,
    target,
    project,
    orchestrator,
    schemas,
  }: {
    valid: boolean;
    target: Target;
    project: Project;
    orchestrator: Orchestrator;
    schemas: readonly Schema[];
  }) {
    try {
      if (valid) {
        const schemaObjects = schemas.map(s => this.helper.createSchemaObject(s));
        const schema = await orchestrator.build(schemaObjects, project.externalComposition);

        await this.updateCDN({
          target,
          project,
          schemas,
          supergraph:
            project.type === ProjectType.FEDERATION
              ? await orchestrator.supergraph(
                  schemas.map(s => this.helper.createSchemaObject(s)),
                  project.externalComposition,
                )
              : null,
          fullSchemaSdl: schema.raw,
        });
      }
    } catch (e) {
      this.logger.error(`Failed to publish to CDN!`, e);
    }
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
    changes: readonly Types.SchemaChange[];
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

  private errorsToMarkdown(errors: readonly Types.SchemaError[]): string {
    return ['', ...errors.map(error => `- ${bolderize(error.message)}`)].join('\n');
  }

  private changesToMarkdown(changes: readonly Types.SchemaChange[]): string {
    const breakingChanges = changes.filter(filterChangesByLevel('Breaking'));
    const dangerousChanges = changes.filter(filterChangesByLevel('Dangerous'));
    const safeChanges = changes.filter(filterChangesByLevel('Safe'));

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

    if (breakingChanges.length) {
      writeChanges('Breaking', breakingChanges, lines);
    }

    if (dangerousChanges.length) {
      writeChanges('Dangerous', dangerousChanges, lines);
    }

    if (safeChanges.length) {
      writeChanges('Safe', safeChanges, lines);
    }

    return lines.join('\n');
  }
}

function filterChangesByLevel(level: Types.CriticalityLevel) {
  return (change: Types.SchemaChange) => change.criticality === level;
}

function writeChanges(type: string, changes: readonly Types.SchemaChange[], lines: string[]): void {
  lines.push(
    ...['', `### ${type} changes`].concat(changes.map(change => ` - ${bolderize(change.message)}`)),
  );
}
