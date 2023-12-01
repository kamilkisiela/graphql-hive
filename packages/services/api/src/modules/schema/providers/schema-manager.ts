import { parse, print } from 'graphql';
import { Inject, Injectable, Scope } from 'graphql-modules';
import lodash from 'lodash';
import { z } from 'zod';
import type { SchemaChangeType, SchemaCheck, SchemaCompositionError } from '@hive/storage';
import { sortSDL } from '@theguild/federation-composition';
import { RegistryModel, SchemaChecksFilter } from '../../../__generated__/types';
import {
  DateRange,
  NativeFederationCompatibilityStatus,
  Orchestrator,
  Organization,
  Project,
  ProjectType,
} from '../../../shared/entities';
import { HiveError } from '../../../shared/errors';
import { atomic, stringifySelector } from '../../../shared/helpers';
import { SchemaVersion } from '../../../shared/mappers';
import { parseGraphQLSource } from '../../../shared/schema';
import { AuthManager } from '../../auth/providers/auth-manager';
import { ProjectAccessScope } from '../../auth/providers/project-access';
import { TargetAccessScope } from '../../auth/providers/target-access';
import { GitHubIntegrationManager } from '../../integrations/providers/github-integration-manager';
import { OrganizationManager } from '../../organization/providers/organization-manager';
import { ProjectManager } from '../../project/providers/project-manager';
import { CryptoProvider } from '../../shared/providers/crypto';
import { Logger } from '../../shared/providers/logger';
import {
  OrganizationSelector,
  ProjectSelector,
  Storage,
  TargetSelector,
} from '../../shared/providers/storage';
import { TargetManager } from '../../target/providers/target-manager';
import { SCHEMA_MODULE_CONFIG, type SchemaModuleConfig } from './config';
import { FederationOrchestrator } from './orchestrators/federation';
import { SingleOrchestrator } from './orchestrators/single';
import { StitchingOrchestrator } from './orchestrators/stitching';
import { ensureCompositeSchemas, SchemaHelper } from './schema-helper';

const ENABLE_EXTERNAL_COMPOSITION_SCHEMA = z.object({
  endpoint: z.string().url().nonempty(),
  secret: z.string().nonempty(),
});

const externalSchemaCompositionTestSdl = /* GraphQL */ `
  type Query {
    test: String
  }
`;
const externalSchemaCompositionTestDocument = parse(externalSchemaCompositionTestSdl);

/**
 * Responsible for auth checks.
 * Talks to Storage.
 */
@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SchemaManager {
  private logger: Logger;

  constructor(
    logger: Logger,
    private authManager: AuthManager,
    private storage: Storage,
    private projectManager: ProjectManager,
    private singleOrchestrator: SingleOrchestrator,
    private stitchingOrchestrator: StitchingOrchestrator,
    private federationOrchestrator: FederationOrchestrator,
    private crypto: CryptoProvider,
    private githubIntegrationManager: GitHubIntegrationManager,
    private targetManager: TargetManager,
    private organizationManager: OrganizationManager,
    private schemaHelper: SchemaHelper,
    @Inject(SCHEMA_MODULE_CONFIG) private schemaModuleConfig: SchemaModuleConfig,
  ) {
    this.logger = logger.child({ source: 'SchemaManager' });
  }

  async hasSchema(selector: TargetSelector) {
    this.logger.debug('Checking if schema is available (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return this.storage.hasSchema(selector);
  }

  @atomic(stringifySelector)
  async getSchemasOfVersion(
    selector: {
      version: string;
      includeMetadata?: boolean;
    } & TargetSelector,
  ) {
    this.logger.debug('Fetching non-empty list of schemas (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    const schemas = await this.storage.getSchemasOfVersion(selector);

    if (schemas.length === 0) {
      throw new HiveError('No schemas found for this version.');
    }

    return schemas;
  }

  @atomic(stringifySelector)
  async getMaybeSchemasOfVersion(
    selector: {
      version: string;
      includeMetadata?: boolean;
    } & TargetSelector,
  ) {
    this.logger.debug('Fetching schemas (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return this.storage.getSchemasOfVersion(selector);
  }

  async getSchemasOfPreviousVersion(
    selector: {
      version: string;
      onlyComposable: boolean;
    } & TargetSelector,
  ) {
    this.logger.debug(
      'Fetching schemas from the previous version (onlyComposable=%s, selector=%o)',
      selector.onlyComposable,
      selector,
    );
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return this.storage.getSchemasOfPreviousVersion(selector);
  }

  async getLatestSchemas(
    selector: TargetSelector & {
      onlyComposable?: boolean;
    },
  ) {
    this.logger.debug('Fetching latest schemas (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return this.storage.getLatestSchemas(selector);
  }

  async getMatchingServiceSchemaOfVersions(versions: { before: string | null; after: string }) {
    this.logger.debug('Fetching service schema of versions (selector=%o)', versions);
    return this.storage.getMatchingServiceSchemaOfVersions(versions);
  }

  async getMaybeLatestValidVersion(selector: TargetSelector) {
    this.logger.debug('Fetching latest valid version (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    const version = await this.storage.getMaybeLatestValidVersion(selector);

    if (!version) {
      return null;
    }

    return {
      ...version,
      project: selector.project,
      target: selector.target,
      organization: selector.organization,
    };
  }

  async getLatestValidVersion(selector: TargetSelector) {
    this.logger.debug('Fetching latest valid version (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return {
      ...(await this.storage.getLatestValidVersion(selector)),
      project: selector.project,
      target: selector.target,
      organization: selector.organization,
    };
  }

  async getLatestVersion(selector: TargetSelector) {
    this.logger.debug('Fetching latest version (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return {
      ...(await this.storage.getLatestVersion(selector)),
      project: selector.project,
      target: selector.target,
      organization: selector.organization,
    };
  }

  async getMaybeLatestVersion(selector: TargetSelector) {
    this.logger.debug('Fetching maybe latest version (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    const latest = await this.storage.getMaybeLatestVersion(selector);

    if (!latest) {
      return null;
    }

    return {
      ...latest,
      project: selector.project,
      target: selector.target,
      organization: selector.organization,
    };
  }

  async getSchemaVersion(selector: TargetSelector & { version: string }) {
    this.logger.debug('Fetching single schema version (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    const result = await this.storage.getVersion(selector);

    return {
      project: selector.project,
      target: selector.target,
      organization: selector.organization,
      ...result,
    };
  }

  async getSchemaChangesForVersion(selector: TargetSelector & { version: string }) {
    this.logger.debug('Fetching single schema version changes (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    return await this.storage.getSchemaChangesForVersion({ versionId: selector.version });
  }

  async getPaginatedSchemaVersionsForTargetId(args: {
    targetId: string;
    organizationId: string;
    projectId: string;
    first: number | null;
    cursor: null | string;
  }) {
    const connection = await this.storage.getPaginatedSchemaVersionsForTargetId(args);

    return {
      ...connection,
      edges: connection.edges.map(edge => ({
        ...edge,
        node: {
          ...edge.node,
          organization: args.organizationId,
          project: args.projectId,
          target: args.targetId,
        },
      })),
    };
  }

  async updateSchemaVersionStatus(
    input: TargetSelector & { version: string; valid: boolean },
  ): Promise<SchemaVersion> {
    this.logger.debug('Updating schema version status (input=%o)', input);
    await this.authManager.ensureTargetAccess({
      ...input,
      scope: TargetAccessScope.REGISTRY_WRITE,
    });

    const project = await this.storage.getProject({
      organization: input.organization,
      project: input.project,
    });

    if (project.legacyRegistryModel) {
      return {
        ...(await this.storage.updateVersionStatus(input)),
        organization: input.organization,
        project: input.project,
        target: input.target,
      };
    }

    throw new HiveError(`Updating the status is supported only by legacy projects`);
  }

  async getSchemaLog(selector: { commit: string } & TargetSelector) {
    this.logger.debug('Fetching schema log (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return this.storage.getSchemaLog({
      commit: selector.commit,
      target: selector.target,
    });
  }

  async createVersion(
    input: ({
      commit: string;
      schema: string;
      author: string;
      valid: boolean;
      service?: string | null;
      logIds: string[];
      url?: string | null;
      base_schema: string | null;
      metadata: string | null;
      projectType: ProjectType;
      actionFn(): Promise<void>;
      changes: Array<SchemaChangeType>;
      previousSchemaVersion: string | null;
      diffSchemaVersionId: string | null;
      github: null | {
        repository: string;
        sha: string;
      };
    } & TargetSelector) &
      (
        | {
            compositeSchemaSDL: null;
            supergraphSDL: null;
            schemaCompositionErrors: Array<SchemaCompositionError>;
            tags: null;
          }
        | {
            compositeSchemaSDL: string;
            supergraphSDL: string | null;
            schemaCompositionErrors: null;
            tags: Array<string> | null;
          }
      ),
  ) {
    this.logger.info(
      'Creating a new version (input=%o)',
      lodash.omit(input, [
        'schema',
        'actionFn',
        'changes',
        'compositeSchemaSDL',
        'supergraphSDL',
        'schemaCompositionErrors',
      ]),
    );

    await this.authManager.ensureTargetAccess({
      project: input.project,
      organization: input.organization,
      target: input.target,
      scope: TargetAccessScope.REGISTRY_WRITE,
    });

    return this.storage.createVersion({
      ...input,
      logIds: input.logIds,
    });
  }

  async testExternalSchemaComposition(selector: { projectId: string; organizationId: string }) {
    await this.authManager.ensureProjectAccess({
      project: selector.projectId,
      organization: selector.organizationId,
      scope: ProjectAccessScope.SETTINGS,
    });

    const [project, organization] = await Promise.all([
      this.storage.getProject({
        organization: selector.organizationId,
        project: selector.projectId,
      }),
      this.storage.getOrganization({
        organization: selector.organizationId,
      }),
    ]);

    if (project.type !== ProjectType.FEDERATION) {
      throw new HiveError(
        'Project is not of Federation type. External composition is not available.',
      );
    }

    if (!project.externalComposition.enabled) {
      throw new HiveError('External composition is not enabled.');
    }

    const orchestrator = this.matchOrchestrator(project.type);

    try {
      const { errors } = await orchestrator.composeAndValidate(
        [
          {
            document: externalSchemaCompositionTestDocument,
            raw: externalSchemaCompositionTestSdl,
            source: 'test',
            url: null,
          },
        ],
        {
          external: project.externalComposition,
          native: this.checkProjectNativeFederationSupport({
            project,
            organization,
          }),
        },
      );

      if (errors.length > 0) {
        return {
          kind: 'error',
          error: errors[0].message,
        } as const;
      }

      return {
        kind: 'success',
        project,
      } as const;
    } catch (error) {
      return {
        kind: 'error',
        error: error instanceof HiveError ? error.message : 'Unknown error',
      } as const;
    }
  }

  matchOrchestrator(projectType: ProjectType): Orchestrator | never {
    switch (projectType) {
      case ProjectType.SINGLE: {
        return this.singleOrchestrator;
      }
      case ProjectType.STITCHING: {
        return this.stitchingOrchestrator;
      }
      case ProjectType.FEDERATION: {
        return this.federationOrchestrator;
      }
      default: {
        throw new HiveError(`Couldn't find an orchestrator for project type "${projectType}"`);
      }
    }
  }

  async getBaseSchema(selector: TargetSelector) {
    this.logger.debug('Fetching base schema (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    return await this.storage.getBaseSchema(selector);
  }
  async updateBaseSchema(selector: TargetSelector, newBaseSchema: string | null) {
    this.logger.debug('Updating base schema (selector=%o)', selector);
    await this.authManager.ensureTargetAccess({
      ...selector,
      scope: TargetAccessScope.REGISTRY_READ,
    });
    await this.storage.updateBaseSchema(selector, newBaseSchema);
  }

  countSchemaVersionsOfProject(
    selector: ProjectSelector & {
      period: DateRange | null;
    },
  ): Promise<number> {
    this.logger.debug('Fetching schema versions count of project (selector=%o)', selector);
    return this.storage.countSchemaVersionsOfProject(selector);
  }

  countSchemaVersionsOfTarget(
    selector: TargetSelector & {
      period: DateRange | null;
    },
  ): Promise<number> {
    this.logger.debug('Fetching schema versions count of target (selector=%o)', selector);
    return this.storage.countSchemaVersionsOfTarget(selector);
  }

  async completeGetStartedCheck(
    selector: OrganizationSelector & {
      step: 'publishingSchema' | 'checkingSchema';
    },
  ) {
    try {
      await this.storage.completeGetStartedStep(selector);
    } catch (error) {
      this.logger.error(
        'Failed to complete get started check (selector=%o, error=%s)',
        selector,
        error,
      );
    }
  }

  async disableExternalSchemaComposition(input: ProjectSelector) {
    this.logger.debug('Disabling external composition (input=%o)', input);
    await this.authManager.ensureProjectAccess({
      ...input,
      scope: ProjectAccessScope.SETTINGS,
    });

    await this.storage.disableExternalSchemaComposition(input);

    return {
      ok: await this.projectManager.getProject({
        organization: input.organization,
        project: input.project,
      }),
    };
  }

  async enableExternalSchemaComposition(
    input: ProjectSelector & {
      endpoint: string;
      secret: string;
    },
  ) {
    this.logger.debug('Enabling external composition (input=%o)', lodash.omit(input, ['secret']));
    await this.authManager.ensureProjectAccess({
      ...input,
      scope: ProjectAccessScope.SETTINGS,
    });

    const parseResult = ENABLE_EXTERNAL_COMPOSITION_SCHEMA.safeParse({
      endpoint: input.endpoint,
      secret: input.secret,
    });

    if (!parseResult.success) {
      return {
        error: {
          message: parseResult.error.message,
          inputErrors: {
            endpoint: parseResult.error.formErrors.fieldErrors.endpoint?.[0],
            secret: parseResult.error.formErrors.fieldErrors.secret?.[0],
          },
        },
      };
    }

    const encryptedSecret = this.crypto.encrypt(input.secret);

    await this.storage.enableExternalSchemaComposition({
      project: input.project,
      organization: input.organization,
      endpoint: input.endpoint.trim(),
      encryptedSecret,
    });

    return {
      ok: await this.projectManager.getProject({
        organization: input.organization,
        project: input.project,
      }),
    };
  }

  async updateNativeSchemaComposition(
    input: ProjectSelector & {
      enabled: boolean;
    },
  ) {
    this.logger.debug('Updating native schema composition (input=%o)', input);
    await this.authManager.ensureProjectAccess({
      ...input,
      scope: ProjectAccessScope.SETTINGS,
    });

    const project = await this.projectManager.getProject({
      organization: input.organization,
      project: input.project,
    });

    if (project.type !== ProjectType.FEDERATION) {
      throw new HiveError(`Native schema composition is supported only by Federation projects`);
    }

    return this.storage.updateNativeSchemaComposition({
      project: input.project,
      organization: input.organization,
      enabled: input.enabled,
    });
  }

  async updateRegistryModel(
    input: ProjectSelector & {
      model: RegistryModel;
    },
  ) {
    this.logger.debug('Updating registry model (input=%o)', input);
    await this.authManager.ensureProjectAccess({
      ...input,
      scope: ProjectAccessScope.SETTINGS,
    });

    return this.storage.updateProjectRegistryModel(input);
  }

  async getPaginatedSchemaChecksForTarget<TransformedSchemaCheck extends SchemaCheck>(args: {
    organizationId: string;
    projectId: string;
    targetId: string;
    first: number | null;
    cursor: string | null;
    transformNode: (check: SchemaCheck) => TransformedSchemaCheck;
    filters: SchemaChecksFilter | null;
  }) {
    await this.authManager.ensureTargetAccess({
      organization: args.organizationId,
      project: args.projectId,
      target: args.targetId,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    const paginatedResult = await this.storage.getPaginatedSchemaChecksForTarget({
      targetId: args.targetId,
      first: args.first,
      cursor: args.cursor,
      transformNode: node => args.transformNode(node),
      filters: args.filters,
    });

    return paginatedResult;
  }

  async findSchemaCheck(args: {
    targetId: string;
    projectId: string;
    organizationId: string;
    schemaCheckId: string;
  }) {
    this.logger.debug('Find schema check (args=%o)', args);
    await this.authManager.ensureTargetAccess({
      target: args.targetId,
      project: args.projectId,
      organization: args.organizationId,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    const schemaCheck = await this.storage.findSchemaCheck({
      schemaCheckId: args.schemaCheckId,
    });

    if (schemaCheck == null) {
      this.logger.debug('Schema check not found (args=%o)', args);
      return null;
    }

    return schemaCheck;
  }

  async getSchemaCheckWebUrl(args: {
    schemaCheckId: string;
    targetId: string;
  }): Promise<null | string> {
    if (this.schemaModuleConfig.schemaCheckLink == null) {
      return null;
    }

    const breadcrumb = await this.storage.getTargetBreadcrumbForTargetId({
      targetId: args.targetId,
    });
    if (!breadcrumb) {
      return null;
    }

    return this.schemaModuleConfig.schemaCheckLink({
      organization: {
        cleanId: breadcrumb.organization,
      },
      project: {
        cleanId: breadcrumb.project,
      },
      target: {
        cleanId: breadcrumb.target,
      },
      schemaCheckId: args.schemaCheckId,
    });
  }

  /**
   * Whether a failed schema check can be approved manually.
   */
  getFailedSchemaCheckCanBeApproved(args: { schemaCompositionErrors: Array<unknown> | null }) {
    return !args.schemaCompositionErrors;
  }

  async getFailedSchemaCheckCanBeApprovedByViewer(args: {
    organizationId: string;
    schemaCompositionErrors: Array<unknown> | null;
  }) {
    if (!this.getFailedSchemaCheckCanBeApproved(args)) {
      return false;
    }

    if (!this.authManager.isUser()) {
      // TODO: support approving a schema check via non web app user?
      return false;
    }

    const user = await this.authManager.getCurrentUser();
    const scopes = await this.authManager.getMemberTargetScopes({
      user: user.id,
      organization: args.organizationId,
    });

    return scopes.includes(TargetAccessScope.REGISTRY_WRITE);
  }

  /**
   * Approve a schema check that failed due to breaking changes.
   * You cannot approve a schema check that failed because composition failed.
   */
  async approveFailedSchemaCheck(args: {
    targetId: string;
    projectId: string;
    organizationId: string;
    schemaCheckId: string;
  }) {
    this.logger.debug('Manually approve failed schema check (args=%o)', args);

    await this.authManager.ensureTargetAccess({
      target: args.targetId,
      project: args.projectId,
      organization: args.organizationId,
      scope: TargetAccessScope.REGISTRY_WRITE,
    });

    let [schemaCheck, viewer] = await Promise.all([
      this.storage.findSchemaCheck({
        schemaCheckId: args.schemaCheckId,
      }),
      this.authManager.getCurrentUser(),
    ]);

    if (schemaCheck == null || schemaCheck.targetId !== args.targetId) {
      this.logger.debug('Schema check not found (args=%o)', args);
      return {
        type: 'error',
        reason: "Schema check doesn't exist.",
      } as const;
    }

    if (schemaCheck.isSuccess) {
      this.logger.debug('Schema check is not failed (args=%o)', args);
      return {
        type: 'error',
        reason: 'Schema check is not failed.',
      } as const;
    }

    if (!this.getFailedSchemaCheckCanBeApproved(schemaCheck)) {
      this.logger.debug(
        'Schema check has composition errors or schema policy errors (args=%o).',
        args,
      );
      return {
        type: 'error',
        reason: 'Schema check has composition errors.',
      } as const;
    }

    if (schemaCheck.githubCheckRunId) {
      this.logger.debug('Attempt updating GitHub schema check. (args=%o).', args);
      const project = await this.projectManager.getProject({
        organization: args.organizationId,
        project: args.projectId,
      });
      const gitRepository = schemaCheck.githubRepository ?? project.gitRepository;
      if (!gitRepository) {
        this.logger.debug(
          'Skip updating GitHub schema check. Schema check has no git repository or project has no git repository connected. (args=%o).',
          args,
        );
      } else {
        const [owner, repository] = gitRepository.split('/');
        const result = await this.githubIntegrationManager.updateCheckRunToSuccess({
          organizationId: args.organizationId,
          checkRun: {
            owner,
            repository,
            checkRunId: schemaCheck.githubCheckRunId,
          },
        });

        // In case updating the check run fails, we don't want to update our database state.
        // Instead, we want to return the error to the user and inform him that there is an issue with GitHub
        // and he needs to try again later.
        if (result?.type === 'error') {
          return {
            type: 'error',
            reason: result.reason,
          } as const;
        }
      }
    }

    schemaCheck = await this.storage.approveFailedSchemaCheck({
      schemaCheckId: args.schemaCheckId,
      userId: viewer.id,
    });

    if (!schemaCheck) {
      return {
        type: 'error',
        reason: "Schema check doesn't exist.",
      } as const;
    }

    return {
      type: 'ok',
      schemaCheck,
    } as const;
  }

  async getApprovedByUser(args: { organizationId: string; userId: string | null }) {
    if (args.userId == null) {
      return null;
    }

    return this.storage.getOrganizationUser({
      organizationId: args.organizationId,
      userId: args.userId,
    });
  }

  async getSchemaVersionByActionId(args: { actionId: string }) {
    const [target, organization] = await Promise.all([
      this.targetManager.getTargetFromToken(),
      this.organizationManager.getOrganizationFromToken(),
    ]);

    this.logger.debug('Fetch schema version by action id. (args=%o)', {
      projectId: target.projectId,
      targetId: target.id,
      actionId: args.actionId,
    });

    await this.authManager.ensureTargetAccess({
      organization: organization.id,
      project: target.projectId,
      target: target.id,
      scope: TargetAccessScope.REGISTRY_READ,
    });

    const record = await this.storage.getSchemaVersionByActionId({
      projectId: target.projectId,
      targetId: target.id,
      actionId: args.actionId,
    });

    if (!record) {
      return null;
    }

    return {
      ...record,
      project: target.projectId,
      target: target.id,
      organization: organization.id,
    };
  }

  async getVersionBeforeVersionId(args: {
    organization: string;
    project: string;
    target: string;
    beforeVersionId: string;
    beforeVersionCreatedAt: string;
  }) {
    this.logger.debug('Fetch version before version id. (args=%o)', args);

    const organization = await this.organizationManager.getOrganization({
      organization: args.organization,
    });

    const schemaVersion = await this.storage.getVersionBeforeVersionId({
      organization: args.organization,
      project: args.project,
      target: args.target,
      beforeVersionId: args.beforeVersionId,
      beforeVersionCreatedAt: args.beforeVersionCreatedAt,
      onlyComposable: organization.featureFlags.compareToPreviousComposableVersion,
    });

    if (!schemaVersion) {
      return null;
    }

    return {
      ...schemaVersion,
      organization: args.organization,
      project: args.project,
      target: args.target,
    };
  }

  async getFirstComposableSchemaVersionBeforeVersionId(args: {
    organization: string;
    project: string;
    target: string;
    beforeVersionId: string;
    beforeVersionCreatedAt: string;
  }) {
    const schemaVersion = await this.storage.getVersionBeforeVersionId({
      organization: args.organization,
      project: args.project,
      target: args.target,
      beforeVersionId: args.beforeVersionId,
      beforeVersionCreatedAt: args.beforeVersionCreatedAt,
      onlyComposable: true,
    });

    if (!schemaVersion) {
      return null;
    }

    return {
      ...schemaVersion,
      organization: args.organization,
      project: args.project,
      target: args.target,
    };
  }

  checkProjectNativeFederationSupport(input: {
    project: Pick<Project, 'id' | 'legacyRegistryModel' | 'nativeFederation'>;
    organization: Pick<Organization, 'id' | 'featureFlags'>;
  }) {
    if (input.project.nativeFederation === false) {
      return false;
    }

    if (input.project.legacyRegistryModel === true) {
      this.logger.warn(
        'Project is using legacy registry model, ignoring native Federation support (organization=%s, project=%s)',
        input.organization.id,
        input.project.id,
      );
      return false;
    }

    if (input.organization.featureFlags.compareToPreviousComposableVersion === false) {
      this.logger.warn(
        'Organization has compareToPreviousComposableVersion FF disabled, ignoring native Federation support (organization=%s, project=%s)',
        input.organization.id,
        input.project.id,
      );
      return false;
    }

    this.logger.debug(
      'Native Federation support available (organization=%s, project=%s)',
      input.organization.id,
      input.project.id,
    );
    return true;
  }

  async getNativeFederationCompatibilityStatus(project: Project) {
    this.logger.debug(
      'Get native Federation compatibility status (organization=%s, project=%s)',
      project.orgId,
      project.id,
    );

    if (project.type !== ProjectType.FEDERATION) {
      return NativeFederationCompatibilityStatus.NOT_APPLICABLE;
    }

    const targets = await this.targetManager.getTargets({
      organization: project.orgId,
      project: project.id,
    });

    const possibleVersions = await Promise.all(
      targets.map(t =>
        this.getMaybeLatestValidVersion({
          organization: project.orgId,
          project: project.id,
          target: t.id,
        }),
      ),
    );

    const versions = possibleVersions.filter((v): v is SchemaVersion => !!v);

    this.logger.debug('Found %s targets and %s versions', targets.length, versions.length);

    // If there are no composable versions available, we can't determine the compatibility status.
    if (
      versions.length === 0 ||
      !versions.every(
        version => version && version.isComposable && typeof version.supergraphSDL === 'string',
      )
    ) {
      this.logger.debug('No composable versions available (status: unknown)');
      return NativeFederationCompatibilityStatus.UNKNOWN;
    }

    const schemasPerVersion = await Promise.all(
      versions.map(async version =>
        this.getSchemasOfVersion({
          organization: version.organization,
          project: version.project,
          target: version.target,
          version: version.id,
        }),
      ),
    );

    const orchestrator = this.matchOrchestrator(ProjectType.FEDERATION);

    this.logger.debug('Checking compatibility of %s versions', versions.length);

    const compatibilityResults = await Promise.all(
      versions.map(async (version, i) => {
        if (schemasPerVersion[i].length === 0) {
          this.logger.debug('No schemas (version=%s)', version.id);
          return NativeFederationCompatibilityStatus.UNKNOWN;
        }

        const compositionResult = await orchestrator.composeAndValidate(
          ensureCompositeSchemas(schemasPerVersion[i]).map(s =>
            this.schemaHelper.createSchemaObject({
              sdl: s.sdl,
              service_name: s.service_name,
              service_url: s.service_url,
            }),
          ),
          {
            native: true,
            external: null,
          },
        );

        if (compositionResult.supergraph) {
          const sortedExistingSupergraph = print(
            sortSDL(
              parseGraphQLSource(
                compositionResult.supergraph,
                'parsing existing supergraph in getNativeFederationCompatibilityStatus',
              ),
            ),
          );
          const sortedNativeSupergraph = print(
            sortSDL(
              parseGraphQLSource(
                version.supergraphSDL!,
                'parsing native supergraph in getNativeFederationCompatibilityStatus',
              ),
            ),
          );

          if (sortedNativeSupergraph === sortedExistingSupergraph) {
            return NativeFederationCompatibilityStatus.COMPATIBLE;
          }

          this.logger.debug('Produced different supergraph (version=%s)', version.id);
        } else {
          this.logger.debug('Failed to produce supergraph (version=%s)', version.id);
        }

        return NativeFederationCompatibilityStatus.INCOMPATIBLE;
      }),
    );

    if (compatibilityResults.includes(NativeFederationCompatibilityStatus.UNKNOWN)) {
      this.logger.debug('One of the versions seems empty (status: unknown)');
      return NativeFederationCompatibilityStatus.UNKNOWN;
    }

    if (compatibilityResults.every(r => r === NativeFederationCompatibilityStatus.COMPATIBLE)) {
      this.logger.debug('All versions are compatible (status: compatible)');
      return NativeFederationCompatibilityStatus.COMPATIBLE;
    }

    this.logger.debug('Some versions are incompatible (status: incompatible)');
    return NativeFederationCompatibilityStatus.INCOMPATIBLE;
  }

  async getGitHubMetadata(schemaVersion: SchemaVersion): Promise<null | {
    repository: `${string}/${string}`;
    commit: string;
  }> {
    if (schemaVersion.github) {
      return {
        repository: schemaVersion.github.repository as `${string}/${string}`,
        commit: schemaVersion.github.sha,
      };
    }

    const log = await this.getSchemaLog({
      commit: schemaVersion.actionId,
      organization: schemaVersion.organization,
      project: schemaVersion.project,
      target: schemaVersion.target,
    });

    if ('commit' in log && log.commit) {
      const project = await this.storage.getProject({
        organization: schemaVersion.organization,
        project: schemaVersion.project,
      });

      if (project.gitRepository) {
        return {
          repository: project.gitRepository,
          commit: log.commit,
        };
      }
    }

    return null;
  }

  async getUserForSchemaChangeById(input: { userId: string }) {
    this.logger.info('Load user by id. (userId=%%)', input.userId);
    const user = await this.storage.getUserById({ id: input.userId });
    if (user) {
      this.logger.info('User found. (userId=%s)', input.userId);
      return user;
    }
    this.logger.info('User not found. (userId=%s)', input.userId);
    return null;
  }
}
