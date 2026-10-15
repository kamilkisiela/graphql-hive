import type { SchemaVersionMapper as SchemaVersion } from '../module.graphql.mappers';
import DataLoader from 'dataloader';
import { parse, print } from 'graphql';
import { Inject, Injectable, Scope } from 'graphql-modules';
import lodash from 'lodash';
import { z } from 'zod';
import { Encryptor, trace, traceFn } from '@hive/service-common';
import type { SchemaCheck } from '@hive/storage';
import { sortSDL } from '@theguild/federation-composition';
import { SchemaChecksFilter } from '../../../__generated__/types';
import * as GraphQLSchema from '../../../__generated__/types';
import {
  DateRange,
  NativeFederationCompatibilityStatusType,
  Organization,
  Project,
  ProjectType,
  Target,
  User,
} from '../../../shared/entities';
import { HiveError } from '../../../shared/errors';
import { atomic, cache, stringifySelector } from '../../../shared/helpers';
import { isUUID } from '../../../shared/is-uuid';
import { parseGraphQLSource } from '../../../shared/schema';
import { Session } from '../../auth/lib/authz';
import { GraphStore, type Graph } from '../../graph/providers/graph-store';
import { GitHubIntegrationManager } from '../../integrations/providers/github-integration-manager';
import { ProjectManager } from '../../project/providers/project-manager';
import { ProjectStore } from '../../project/providers/project-store';
import { IdTranslator } from '../../shared/providers/id-translator';
import { Logger } from '../../shared/providers/logger';
import {
  OrganizationSelector,
  ProjectSelector,
  Storage,
  TargetSelector,
} from '../../shared/providers/storage';
import { TargetManager } from '../../target/providers/target-manager';
import { TargetStore } from '../../target/providers/target-store';
import { SCHEMA_MODULE_CONFIG, type SchemaModuleConfig } from './config';
import { Contracts } from './contracts';
import { CompositionOrchestrator } from './orchestrator/composition-orchestrator';
import { ensureCompositeSchemas, removeDescriptions, SchemaHelper } from './schema-helper';
import {
  SchemaVersionStore,
  type SchemaVersion as StoredSchemaVersion,
} from './schema-version-store';

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
  private latestSchemaVersionLoader: DataLoader<TargetSelector, SchemaVersion>;
  private latestValidVersionByGraphLoader: DataLoader<Graph, StoredSchemaVersion | null, string>;

  constructor(
    logger: Logger,
    private session: Session,
    private storage: Storage,
    private projectStore: ProjectStore,
    private targetStore: TargetStore,
    private projectManager: ProjectManager,
    private compositionOrchestrator: CompositionOrchestrator,
    private crypto: Encryptor,
    private githubIntegrationManager: GitHubIntegrationManager,
    private targetManager: TargetManager,
    private schemaHelper: SchemaHelper,
    private contracts: Contracts,
    private idTranslator: IdTranslator,
    private schemaVersions: SchemaVersionStore,
    private graphs: GraphStore,
    @Inject(SCHEMA_MODULE_CONFIG) private schemaModuleConfig: SchemaModuleConfig,
  ) {
    this.logger = logger.child({ source: 'SchemaManager' });
    this.latestSchemaVersionLoader = new DataLoader(
      selectors => {
        return Promise.all(
          selectors.map(async selector => {
            const graph = await graphs.getDefaultGraphForTargetId(selector.targetId);

            return {
              ...(await this.schemaVersions.getLatestValidSchemaVersionForGraph(graph)),
              projectId: selector.projectId,
              targetId: selector.targetId,
              organizationId: selector.organizationId,
            };
          }),
        );
      },
      {
        cacheKeyFn(selector) {
          return selector.targetId;
        },
      },
    );
    this.latestValidVersionByGraphLoader = new DataLoader(
      graphs =>
        Promise.all(
          graphs.map(graph => this.schemaVersions.getMaybeLatestValidSchemaVersionForGraph(graph)),
        ),
      { cacheKeyFn: graph => graph.id },
    );
  }

  async hasPublishedSchemaVersionInDefaultGraph(target: Target) {
    this.logger.debug('Checking if schema is available (targetId=%s)', target.id);
    const graph = await this.graphs.getDefaultGraphForTargetId(target.id);
    return this.schemaVersions.anyVersionExistsForGraph(graph);
  }

  @traceFn('SchemaManager.compose', {
    initAttributes: input => ({
      'hive.organization.slug': input.target?.bySelector?.organizationSlug,
      'hive.project.slug': input.target?.bySelector?.projectSlug,
      'hive.target.slug': input.target?.bySelector?.targetSlug,
      'hive.target.id': input.target?.byId ?? undefined,
      'input.only.composable': input.onlyComposable,
      'input.services.count': input.services.length,
    }),
  })
  async compose(input: {
    onlyComposable: boolean;
    services: ReadonlyArray<{
      sdl: string;
      url?: string | null;
      name: string;
    }>;
    target: GraphQLSchema.TargetReferenceInput | null;
  }) {
    this.logger.debug('Composing schemas (input=%o)', lodash.omit(input, 'services'));

    const selector = await this.idTranslator.resolveTargetReference({
      reference: input.target ?? null,
    });

    if (!selector) {
      this.session.raise('schema:compose');
    }

    trace.getActiveSpan()?.setAttributes({
      'hive.organization.id': selector.organizationId,
      'hive.target.id': selector.targetId,
      'hive.project.id': selector.projectId,
    });

    await this.session.canPerformAction({
      action: 'schema:compose',
      organizationId: selector.organizationId,
      params: {
        organizationId: selector.organizationId,
        projectId: selector.projectId,
        targetId: selector.targetId,
      },
    });

    const [organization, project, graph] = await Promise.all([
      this.storage.getOrganization({
        organizationId: selector.organizationId,
      }),
      this.projectStore.getProject({
        organizationId: selector.organizationId,
        projectId: selector.projectId,
      }),
      this.graphs.getDefaultGraphForTargetId(selector.targetId),
    ]);

    if (project.type !== ProjectType.FEDERATION) {
      return {
        kind: 'error' as const,
        message: 'Only Federation projects are supported',
      };
    }

    const latestSchemas = await this.getLatestSchemaVersionWithSchemaLogsForGraph({
      graph,
      onlyComposable: input.onlyComposable,
    });

    const existingServices = ensureCompositeSchemas(latestSchemas ? latestSchemas.schemas : []);
    const services = existingServices
      // remove provided services from the list
      .filter(service => !input.services.some(s => s.name === service.service_name))
      .map(service => ({
        serviceName: service.service_name,
        sdl: service.sdl,
        serviceUrl: service.service_url,
      }))
      // add provided services to the list
      .concat(
        input.services.map(service => ({
          serviceName: service.name,
          sdl: service.sdl,
          serviceUrl: service.url ?? '',
        })),
      )
      .map(service => this.schemaHelper.createSchemaObject(service));

    const compositionResult = await this.compositionOrchestrator.composeAndValidate(
      'federation',
      services,
      {
        external: project.externalComposition,
        native: this.checkProjectNativeFederationSupport({
          project,
          organization,
          targetId: selector.targetId,
        }),
        contracts: null,
      },
    );

    if (compositionResult.errors.length > 0) {
      return {
        kind: 'success' as const,
        errors: compositionResult.errors,
      };
    }

    if (compositionResult.supergraph) {
      return {
        kind: 'success' as const,
        supergraphSDL: compositionResult.supergraph,
      };
    }

    throw new Error('Composition was successful but is missing a supergraph');
  }

  @traceFn('SchemaManager.getSchemasOfVersion', {
    initAttributes: selector => ({
      'hive.target.id': selector.targetId,
      'hive.organization.id': selector.organizationId,
      'hive.project.id': selector.projectId,
      'hive.version.id': selector.versionId,
    }),
  })
  @atomic(stringifySelector)
  async getSchemasOfVersion(
    selector: {
      versionId: string;
      includeMetadata?: boolean;
    } & TargetSelector,
  ) {
    this.logger.debug('Fetching non-empty list of schemas (selector=%o)', selector);
    const schemas = await this.schemaVersions.getSchemasBySchemaVersionId(selector.versionId);

    if (schemas.length === 0) {
      throw new HiveError('No schemas found for this version.');
    }

    return schemas;
  }

  @traceFn('SchemaManager.getSchemasOfVersion', {
    initAttributes: input => ({
      'hive.target.id': input.targetId,
      'hive.organization.id': input.organizationId,
      'hive.project.id': input.projectId,
      'hive.version.id': input.id,
    }),
  })
  @atomic(stringifySelector)
  async getMaybeSchemasOfVersion(schemaVersion: SchemaVersion) {
    this.logger.debug('Fetching schemas (schemaVersionId=%s)', schemaVersion.id);
    return this.schemaVersions.getSchemasBySchemaVersionId(schemaVersion.id);
  }

  async getServiceNamesOfVersion(schemaVersion: SchemaVersion) {
    const project = await this.projectManager.getProjectById(schemaVersion.projectId);
    // Single-schema pushes carry no service name, so there is nothing to list.
    if (project.type === ProjectType.SINGLE) {
      return null;
    }
    this.logger.debug('Fetching service names (schemaVersionId=%s)', schemaVersion.id);
    return this.schemaVersions.getServiceNamesBySchemaVersionId(schemaVersion.id);
  }

  async getMatchingServiceSchemaOfVersions(versions: { before: string | null; after: string }) {
    this.logger.debug('Fetching service schema of versions (selector=%o)', versions);
    return this.schemaVersions.getMatchingServiceSchemaOfVersions(versions);
  }

  async getMaybeLatestValidVersionForGraph(graph: Graph) {
    this.logger.debug('Fetching maybe latest valid version (graphId=%s)', graph.id);

    const version = await this.latestValidVersionByGraphLoader.load(graph);

    if (!version) {
      return null;
    }

    return {
      ...version,
      projectId: graph.projectId,
      targetId: graph.targetId,
      organizationId: graph.organizationId,
    };
  }

  async getSchemaVersionWithTargetAndGraphBySchemaVersionIdForProject(
    project: Project,
    schemaVersionId: string,
  ): Promise<null | {
    target: Target;
    graph: Graph;
    schemaVersion: SchemaVersion & {
      projectId: string;
      targetId: string;
      organizationId: string;
    };
  }> {
    this.logger.debug(
      'Lookup up schema version by id for project (projectId=%s, schemaVersionId=%s)',
      project.id,
      schemaVersionId,
    );
    const schemaVersion = await this.schemaVersions.getSchemaVersionById(schemaVersionId);

    if (!schemaVersion) {
      this.logger.debug('The schema version was not found. (schemaVersionId=%s)', schemaVersionId);
      return null;
    }

    const target = await this.targetStore.getTargetById(schemaVersion.targetId);

    if (!target) {
      this.logger.debug(
        'The target of the schema version was not found. (targetId=%s)',
        schemaVersion.targetId,
      );
      return null;
    }

    if (target.projectId !== project.id) {
      this.logger.debug(
        'The found schema version does not belong to the specified project. (expectedProjectId=%s, actualProjectId=%s)',
        project.id,
        target.projectId,
      );
      return null;
    }

    const graph = await this.graphs.findGraphForSchemaVersion(schemaVersion);

    if (!graph) {
      this.logger.debug(
        'The graph the schema version belongs to was deleted.',
        project.id,
        target.projectId,
      );
      return null;
    }

    this.logger.debug(
      'The schema version, target and graph were found. (targetId=%s, schemaVersionId=%s, graphId=%s)',
      schemaVersion.targetId,
      schemaVersion.id,
      graph.id,
    );

    return {
      target,
      graph,
      schemaVersion: {
        ...schemaVersion,
        projectId: target.projectId,
        targetId: target.id,
        organizationId: target.orgId,
      },
    };
  }

  async getLatestValidVersion(selector: TargetSelector) {
    this.logger.debug('Fetching latest valid version (selector=%o)', selector);
    return this.latestSchemaVersionLoader.load(selector);
  }

  async getMaybeLatestVersionForGraph(graph: Graph) {
    this.logger.debug('Fetching maybe latest version (graphId=%s)', graph.id);
    const latest = await this.schemaVersions.getMaybeLatestSchemaVersionForGraph(graph);

    if (!latest) {
      return null;
    }

    return {
      ...latest,
      projectId: graph.projectId,
      targetId: graph.targetId,
      organizationId: graph.organizationId,
    };
  }

  async getSchemaVersionBySelector(
    selector: TargetSelector & { versionId: string },
  ): Promise<SchemaVersion | null> {
    this.logger.debug('Fetching single schema version (selector=%o)', selector);

    if (isUUID(selector.versionId) === false) {
      this.logger.debug('Invalid UUID provided. (versionId=%s)', selector.versionId);
      return null;
    }

    const version = await this.schemaVersions.getSchemaVersionById(selector.versionId);

    if (!version) {
      return null;
    }

    if (version.targetId !== selector.targetId) {
      return null;
    }

    return {
      projectId: selector.projectId,
      organizationId: selector.organizationId,
      ...version,
    };
  }

  /**
   * Retrieve the latest schema version including the schema logs.
   */
  async getLatestSchemaVersionWithSchemaLogsForGraph(args: {
    graph: Graph;
    onlyComposable?: boolean;
  }) {
    const schemaVersion = await (args.onlyComposable
      ? this.getMaybeLatestValidVersionForGraph(args.graph)
      : this.getMaybeLatestVersionForGraph(args.graph));

    if (!schemaVersion) {
      return null;
    }

    const schemas = await this.schemaVersions.getSchemasBySchemaVersionId(schemaVersion.id);

    return {
      version: schemaVersion,
      schemas,
    };
  }

  async getPaginatedSchemaVersionsForGraph(
    graph: Graph,
    args: {
      first: number | null;
      cursor: null | string;
    },
  ) {
    const first = args.first ? (args.first > 0 ? Math.min(args.first, 20) : 20) : 20;
    const connection = await this.schemaVersions.getPaginatedSchemaVersionsForGraph(graph, {
      first,
      cursor: args.cursor,
    });

    return {
      ...connection,
      edges: connection.edges.map(edge => ({
        ...edge,
        node: {
          ...edge.node,
          organizationId: graph.organizationId,
          projectId: graph.projectId,
          targetId: graph.targetId,
        },
      })),
    };
  }

  async getPaginatedSchemaChecksForSchemaProposal<
    TransformedSchemaCheck extends SchemaCheck = SchemaCheck,
  >(args: {
    transformNode?: (check: SchemaCheck) => TransformedSchemaCheck;
    proposalId: string;
    first: number | null;
    cursor: string | null;
    latest?: boolean;
  }) {
    const connection = await this.storage.getPaginatedSchemaChecksForSchemaProposal(args);
    return connection;
  }

  async getSchemaLogById(schemaLogId: string) {
    this.logger.debug('Fetching schema log by id (schemaLogId=%s)', schemaLogId);
    return this.schemaVersions.getSchemaLogById(schemaLogId);
  }

  async testExternalSchemaComposition(selector: { projectId: string; organizationId: string }) {
    await this.session.assertPerformAction({
      organizationId: selector.organizationId,
      action: 'project:modifySettings',
      params: {
        organizationId: selector.organizationId,
        projectId: selector.projectId,
      },
    });

    const project = await this.projectStore.getProject({
      organizationId: selector.organizationId,
      projectId: selector.projectId,
    });

    if (project.type !== ProjectType.FEDERATION) {
      throw new HiveError(
        'Project is not of Federation type. External composition is not available.',
      );
    }

    if (!project.externalComposition.enabled) {
      throw new HiveError('External composition is not enabled.');
    }

    try {
      const { errors } = await this.compositionOrchestrator.composeAndValidate(
        'federation',
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
          // when testing external composition, do not use native composition during the check
          native: false,
          contracts: null,
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

  async getBaseSchemaForTarget(target: Target) {
    this.logger.debug('Fetching base schema (selector=%o)', target);

    return await this.storage.getBaseSchema({
      organizationId: target.orgId,
      projectId: target.projectId,
      targetId: target.id,
    });
  }
  async updateBaseSchema(selector: TargetSelector, newBaseSchema: string | null) {
    this.logger.debug('Updating base schema (selector=%o)', selector);
    await this.session.assertPerformAction({
      action: 'target:modifySettings',
      organizationId: selector.organizationId,
      params: {
        organizationId: selector.organizationId,
        projectId: selector.projectId,
        targetId: selector.targetId,
      },
    });
    await this.storage.updateBaseSchema(selector, newBaseSchema);
  }

  countSchemaVersionsOfDefaultGraphsInProject(
    project: Project,
    period: DateRange | null,
  ): Promise<number> {
    this.logger.debug('Fetching schema versions count of project (projectId=%s)', project.id);
    return this.schemaVersions.countSchemaVersionsOfDefaultGraphsInProject(project, period);
  }

  countSchemaVersionsOfGraph(graph: Graph, period: DateRange | null): Promise<number> {
    this.logger.debug('Fetching schema versions count of graph (graphId=%s)', graph.id);
    return this.schemaVersions.countSchemaVersionsOfTarget(graph, period);
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

  async updateSchemaComposition(
    input: ProjectSelector &
      (
        | { mode: 'native' }
        | { mode: 'legacy' }
        | {
            mode: 'external';
            endpoint: string;
            secret: string;
          }
      ),
  ) {
    this.logger.debug('Updating schema composition settings (input=%o)', input);
    await this.session.assertPerformAction({
      organizationId: input.organizationId,
      action: 'project:modifySettings',
      params: {
        organizationId: input.organizationId,
        projectId: input.projectId,
      },
    });

    const project = await this.projectManager.getProject({
      organizationId: input.organizationId,
      projectId: input.projectId,
    });

    if (project.type !== ProjectType.FEDERATION) {
      const message = 'Schema composition is supported only by Federation projects';
      if (input.mode === 'native') {
        return { error: { __typename: 'UpdateSchemaCompositionNativeError', message } } as const;
      }
      if (input.mode === 'legacy') {
        return { error: { __typename: 'UpdateSchemaCompositionLegacyError', message } } as const;
      }
      if (input.mode === 'external') {
        return { error: { __typename: 'UpdateSchemaCompositionExternalError', message } } as const;
      }
    }

    switch (input.mode) {
      case 'native': {
        return {
          ok: {
            updatedProject: await this.projectStore.updateNativeSchemaComposition({
              projectId: input.projectId,
              organizationId: input.organizationId,
              enabled: true,
            }),
          },
        };
      }
      case 'legacy': {
        return {
          ok: {
            updatedProject: await this.projectStore.updateNativeSchemaComposition({
              projectId: input.projectId,
              organizationId: input.organizationId,
              enabled: false,
            }),
          },
        };
      }
      case 'external': {
        const parseResult = ENABLE_EXTERNAL_COMPOSITION_SCHEMA.safeParse({
          endpoint: input.endpoint,
          secret: input.secret,
        });

        if (!parseResult.success) {
          return {
            error: {
              __typename: 'UpdateSchemaCompositionExternalError' as const,
              message: parseResult.error.message,
              inputErrors: {
                endpoint: parseResult.error.formErrors.fieldErrors.endpoint?.[0],
                secret: parseResult.error.formErrors.fieldErrors.secret?.[0],
              },
            },
          };
        }

        return {
          ok: {
            updatedProject: await this.projectStore.enableExternalSchemaComposition({
              projectId: input.projectId,
              organizationId: input.organizationId,
              endpoint: parseResult.data.endpoint.trim(),
              encryptedSecret: this.crypto.encrypt(parseResult.data.secret),
            }),
          },
        };
      }
      default: {
        const _: never = input;
        throw new HiveError('Unexpected input');
      }
    }
  }

  async getPaginatedSchemaChecksForTarget<TransformedSchemaCheck extends SchemaCheck>(
    target: Target,
    args: {
      first: number | null;
      cursor: string | null;
      transformNode: (check: SchemaCheck) => TransformedSchemaCheck;
      filters: SchemaChecksFilter | null;
      withSDL: boolean;
      withChanges: boolean;
    },
  ) {
    const paginatedResult = await this.storage.getPaginatedSchemaChecksForTarget({
      targetId: target.id,
      first: args.first,
      cursor: args.cursor,
      transformNode: node => args.transformNode(node),
      filters: args.filters,
      withSDL: args.withSDL,
      withChanges: args.withChanges,
    });

    return paginatedResult;
  }

  async findSchemaCheckForTarget(
    target: Target,
    schemaCheckId: string,
    options: { withSDL?: boolean } = {},
  ) {
    this.logger.debug(
      'Find schema check (targetId=%s, schemaCheckId=%s)',
      target.id,
      schemaCheckId,
    );

    if (isUUID(schemaCheckId) === false) {
      this.logger.debug(
        'Invalid ID provided (targetId=%s, schemaCheckId=%s)',
        target.id,
        schemaCheckId,
      );

      return null;
    }

    const schemaCheck = await this.storage.findSchemaCheck({
      targetId: target.id,
      schemaCheckId,
      withSDL: options.withSDL,
    });

    if (schemaCheck == null) {
      this.logger.debug(
        'Schema check not found (targetId=%s, schemaCheckId=%s)',
        target.id,
        schemaCheckId,
      );
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

    const breadcrumb = await this.targetStore.getTargetBreadcrumbForTargetId({
      targetId: args.targetId,
    });
    if (!breadcrumb) {
      return null;
    }

    return this.schemaModuleConfig.schemaCheckLink({
      organization: {
        slug: breadcrumb.organizationSlug,
      },
      project: {
        slug: breadcrumb.projectSlug,
      },
      target: {
        slug: breadcrumb.targetSlug,
      },
      schemaCheckId: args.schemaCheckId,
    });
  }

  /**
   * Whether a failed schema check can be approved manually.
   */
  @cache<SchemaCheck>(schemaCheck => schemaCheck.id)
  async getFailedSchemaCheckCanBeApproved(schemaCheck: SchemaCheck) {
    this.logger.debug(
      'Check if failed schema check can be approved. (schemaCheckId=%s)',
      schemaCheck.id,
    );

    if (schemaCheck.baselineCompositionErrors !== null) {
      this.logger.debug(
        'Check can not be approved due to baseline composition errors. (schemaCheckId=%s)',
        schemaCheck.id,
      );
      return false;
    }

    if (schemaCheck.schemaCompositionErrors !== null) {
      this.logger.debug(
        'Check can not be approved due to composition errors. (schemaCheckId=%s)',
        schemaCheck.id,
      );
      return false;
    }

    this.logger.debug(
      'Check if contracts have composition errors. (schemaCheckId=%s)',
      schemaCheck.id,
    );

    const contracts = await this.contracts.getContractChecksBySchemaCheckId({
      schemaCheckId: schemaCheck.id,
      onlyFailedWithBreakingChanges: false,
    });

    if (contracts === null) {
      this.logger.debug(
        'No contracts found, schema check can be approved. (schemaCheckId=%s)',
        schemaCheck.id,
      );

      return true;
    }

    this.logger.debug(
      '%s contract(s) found, schema check can be approved. (schemaCheckId=%s)',
      schemaCheck.id,
      contracts.length,
    );

    for (const contract of contracts) {
      if (contract.baselineSchemaCompositionErrors !== null) {
        this.logger.debug(
          'Contract has baseline composition errors, schema check can not be approved. (schemaCheckId=%s, contractId=%s)',
          schemaCheck.id,
          contract.contractId,
        );
        return false;
      }
      if (contract.schemaCompositionErrors !== null) {
        this.logger.debug(
          'Contract has composition errors, schema check can not be approved. (schemaCheckId=%s, contractId=%s)',
          schemaCheck.id,
          contract.contractId,
        );
        return false;
      }
    }

    return true;
  }

  async getFailedSchemaCheckCanBeApprovedByViewer(
    schemaCheck: SchemaCheck & {
      selector: {
        organizationId: string;
        projectId: string;
      };
    },
  ) {
    if (!this.session.getViewer()) {
      // TODO: support approving a schema check via non web app user?
      return false;
    }

    const isViewer = this.session.isViewer();

    if (!isViewer) {
      return false;
    }

    const isAllowedToApproveFailedSchemaCheck = await this.session.canPerformAction({
      action: 'schemaCheck:approve',
      organizationId: schemaCheck.selector.organizationId,
      params: {
        organizationId: schemaCheck.selector.organizationId,
        projectId: schemaCheck.selector.projectId,
        targetId: schemaCheck.targetId,
        serviceName: schemaCheck.serviceName ?? null,
      },
    });

    if (isAllowedToApproveFailedSchemaCheck === false) {
      return false;
    }

    return await this.getFailedSchemaCheckCanBeApproved(schemaCheck);
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
    comment: string | null | undefined;
    author?: string | null;
  }) {
    this.logger.debug('Manually approve failed schema check (args=%o)', args);

    let viewer: User | null = null;
    try {
      viewer = await this.session.getViewer();
    } catch (error) {
      this.logger.debug('No viewer available (likely using CLI) (args=%o)', args);
    }

    let [schemaCheck, target] = await Promise.all([
      this.storage.findSchemaCheck({
        targetId: args.targetId,
        schemaCheckId: args.schemaCheckId,
      }),
      this.targetStore.getTarget({
        organizationId: args.organizationId,
        projectId: args.projectId,
        targetId: args.targetId,
      }),
    ]);

    if (schemaCheck == null || schemaCheck.targetId !== args.targetId) {
      this.logger.debug('Schema check not found (args=%o)', args);
      return {
        type: 'error',
        reason: "Schema check doesn't exist.",
      } as const;
    }

    await this.session.assertPerformAction({
      action: 'schemaCheck:approve',
      organizationId: args.organizationId,
      params: {
        organizationId: target.orgId,
        projectId: target.projectId,
        targetId: target.id,
        serviceName: schemaCheck.serviceName ?? null,
      },
    });

    if (schemaCheck.isSuccess) {
      this.logger.debug('Schema check is not failed (args=%o)', args);
      return {
        type: 'error',
        reason: 'Schema check is not failed.',
      } as const;
    }

    if (!(await this.getFailedSchemaCheckCanBeApproved(schemaCheck))) {
      this.logger.debug('Schema check can not be approved. (args=%o)', args);
      return {
        type: 'error',
        reason: 'Schema check has composition errors.',
      } as const;
    }

    if (schemaCheck.githubCheckRunId) {
      this.logger.debug('Attempt updating GitHub schema check. (args=%o).', args);
      const project = await this.projectManager.getProject({
        organizationId: args.organizationId,
        projectId: args.projectId,
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
      targetId: target.id,
      contracts: this.contracts,
      schemaCheckId: args.schemaCheckId,
      userId: viewer?.id ?? null,
      comment: args.comment,
      author: args.author ?? null,
    });

    if (!schemaCheck) {
      // Re-fetch the schema check to determine why approval failed
      const recheck = await this.storage.findSchemaCheck({
        targetId: args.targetId,
        schemaCheckId: args.schemaCheckId,
      });

      if (recheck?.schemaPolicyErrors !== null) {
        return {
          type: 'error',
          reason: 'Schema check has schema policy errors that must be resolved before approval.',
        } as const;
      }

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

    return this.storage.getUserById({
      id: args.userId,
    });
  }

  async getSchemaVersionByCommit(args: {
    commit: string;
    target: GraphQLSchema.TargetReferenceInput | null;
  }) {
    const selector = await this.idTranslator.resolveTargetReference({
      reference: args.target,
    });

    if (!selector) {
      this.session.raise('project:describe');
    }

    this.logger.debug('Fetch schema version by commit. (args=%o)', {
      projectId: selector.projectId,
      targetId: selector.targetId,
      commit: args.commit,
    });

    await this.session.assertPerformAction({
      action: 'project:describe',
      organizationId: selector.organizationId,
      params: {
        organizationId: selector.organizationId,
        projectId: selector.projectId,
      },
    });

    const target = await this.targetManager.getTargetById({ targetId: selector.targetId });
    const graph = await this.graphs.getDefaultGraphForTargetId(target.id);

    const record = await this.schemaVersions.getSchemaVersionForGraphByCommit(graph, args.commit);

    if (!record) {
      return null;
    }

    return {
      ...record,
      projectId: selector.projectId,
      targetId: selector.targetId,
      organizationId: selector.organizationId,
    };
  }

  async getComposableVersionBeforeVersionId(schemaVersion: SchemaVersion) {
    this.logger.debug('Fetch version before version id. (schemaVersionId=%s)', schemaVersion.id);

    const previousSchemaVersion = await this.schemaVersions.getSchemaVersionBeforeSchemaVersion(
      schemaVersion,
      true,
    );

    if (!previousSchemaVersion) {
      return null;
    }

    return {
      ...previousSchemaVersion,
      organizationId: schemaVersion.organizationId,
      projectId: schemaVersion.projectId,
      targetId: schemaVersion.targetId,
    };
  }

  async getFirstComposableSchemaVersionBeforeSchemaVersion(previousSchemaVersion: SchemaVersion) {
    const schemaVersion = await this.schemaVersions.getSchemaVersionBeforeSchemaVersion(
      previousSchemaVersion,
      true,
    );

    if (!schemaVersion) {
      return null;
    }

    return {
      ...schemaVersion,
      organizationId: previousSchemaVersion.organizationId,
      projectId: previousSchemaVersion.projectId,
      targetId: previousSchemaVersion.targetId,
    };
  }

  checkProjectNativeFederationSupport(input: {
    targetId: string | null;
    project: Pick<Project, 'id' | 'nativeFederation'>;
    organization: Pick<Organization, 'id' | 'featureFlags'>;
  }) {
    if (input.project.nativeFederation === false) {
      return false;
    }

    if (
      input.targetId &&
      input.organization.featureFlags.forceLegacyCompositionInTargets.includes(input.targetId)
    ) {
      this.logger.warn(
        'Native Federation support is disabled for this target (organization=%s, project=%s, target=%s)',
        input.organization.id,
        input.project.id,
        input.targetId,
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

  async getNativeFederationCompatibilityStatus(project: Project): Promise<{
    status: NativeFederationCompatibilityStatusType;
    results: Array<null | {
      schemaVersion: SchemaVersion | null;
      target: Target;
      nativeCompositionResult: {
        duration: number;
        supergraphSdl: string | null;
        errors: Array<{ message: string }> | null;
      };
      currentSupergraphSdl: string | null;
    }>;
  }> {
    this.logger.debug(
      'Get native Federation compatibility status (organization=%s, project=%s)',
      project.orgId,
      project.id,
    );

    if (project.type !== ProjectType.FEDERATION) {
      return {
        status: NativeFederationCompatibilityStatusType.NOT_APPLICABLE,
        results: [],
      };
    }

    const targets = await this.targetManager.getTargets({
      organizationId: project.orgId,
      projectId: project.id,
    });

    const results = await Promise.all(
      targets.map(async target => {
        const graph = await this.graphs.getDefaultGraphForTargetId(target.id);
        const schemaVersion = await this.getMaybeLatestValidVersionForGraph(graph);

        if (schemaVersion === null) {
          return {
            target,
            schemaVersion,
            currentSupergraphSdl: null,
            nativeCompositionResult: {
              duration: 0,
              supergraphSdl: null,
              errors: null,
            },
          };
        }

        const currentSupergraphSdl = print(
          removeDescriptions(
            sortSDL(
              parseGraphQLSource(
                schemaVersion.supergraphSDL!,
                'parsing native supergraph in getNativeFederationCompatibilityStatus',
              ),
            ),
          ),
        );

        const schemas = await this.getSchemasOfVersion({
          organizationId: target.orgId,
          projectId: target.projectId,
          targetId: target.id,
          versionId: schemaVersion.id,
        });

        if (schemas.length === 0) {
          return {
            target,
            schemaVersion,
            currentSupergraphSdl,
            nativeCompositionResult: {
              duration: 0,
              supergraphSdl: null,
              errors: null,
            },
          };
        }

        const start = Date.now();
        const compositionResult = await this.compositionOrchestrator.composeAndValidate(
          'federation',
          ensureCompositeSchemas(schemas).map(s =>
            this.schemaHelper.createSchemaObject({
              sdl: s.sdl,
              serviceName: s.service_name,
              serviceUrl: s.service_url,
            }),
          ),
          {
            native: true,
            external: {
              enabled: false,
            },
            contracts: null,
          },
        );

        const supergraphSdl = compositionResult.supergraph
          ? print(
              removeDescriptions(
                sortSDL(
                  parseGraphQLSource(
                    compositionResult.supergraph,
                    'parsing native supergraph in getNativeFederationCompatibilityStatus',
                  ),
                ),
              ),
            )
          : null;

        return {
          target,
          schemaVersion,
          currentSupergraphSdl,
          nativeCompositionResult: {
            duration: Date.now() - start,
            supergraphSdl,
            errors: compositionResult.errors,
          },
        };
      }),
    );

    let status = NativeFederationCompatibilityStatusType.INCOMPATIBLE;

    if (results.every(result => result === null)) {
      this.logger.debug('No composable versions available (status: unknown)');
      status = NativeFederationCompatibilityStatusType.UNKNOWN;
    } else if (
      results.every(
        result =>
          result === null ||
          (result.nativeCompositionResult &&
            result.currentSupergraphSdl === result.nativeCompositionResult.supergraphSdl),
      )
    ) {
      this.logger.debug('All versions are compatible (status: compatible)');
      status = NativeFederationCompatibilityStatusType.COMPATIBLE;
    }

    return {
      status,
      results,
    };
  }

  async getSchemaVersionForGraphById(graph: Graph, id: string) {
    if (!isUUID(id)) {
      this.logger.debug('Invalid UUID provided. (versionId=%s)', id);
      return null;
    }
    const version = await this.schemaVersions.getSchemaVersionForGraphById(graph, id);

    if (!version) {
      return null;
    }

    return {
      projectId: graph.projectId,
      organizationId: graph.organizationId,
      ...version,
    };
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

    // A schema version must have an action id if it has no github property
    // So we can short-circuit here and resolve to "null"
    if (!schemaVersion.actionId) {
      return null;
    }

    const log = await this.getSchemaLogById(schemaVersion.actionId);

    if ('commit' in log && log.commit) {
      const project = await this.projectManager.getProjectById(schemaVersion.projectId);

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
