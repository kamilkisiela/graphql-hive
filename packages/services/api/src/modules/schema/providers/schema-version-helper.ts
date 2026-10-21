import type { SchemaVersionMapper as SchemaVersion } from '../module.graphql.mappers';
import { __Type, isTypeSystemExtensionNode, print } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import { CriticalityLevel } from '@graphql-inspector/core';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { invariant, traceFn } from '@hive/service-common';
import type { SchemaChangeType } from '@hive/storage';
import {
  containsSupergraphSpec,
  transformSupergraphToPublicSchema,
} from '@theguild/federation-composition';
import type { ResolversUnionTypes } from '../../../__generated__/types';
import { ProjectType, SchemaLog } from '../../../shared/entities';
import { cache } from '../../../shared/helpers';
import { parseGraphQLSource } from '../../../shared/schema';
import { ProjectManager } from '../../project/providers/project-manager';
import { Logger } from '../../shared/providers/logger';
import { Storage } from '../../shared/providers/storage';
import { TargetStore } from '../../target/providers/target-store';
import { BreakingSchemaChangeUsageHelper } from './breaking-schema-changes-helper';
import { CompositionOrchestrator } from './orchestrator/composition-orchestrator';
import { RegistryChecks } from './registry-checks';
import { ensureCompositeSchemas, SchemaHelper, toCompositeSchemaInput } from './schema-helper';
import { SchemaManager } from './schema-manager';
import { SchemaVersionStore } from './schema-version-store';

@Injectable({
  scope: Scope.Operation,
  global: true,
})
/**
 * Utilities for working with schema versions.
 * Because we only started introducing persisting changes/sdl/supergraph later on,
 * we sometimes have to compute them on the fly when someone is accessing older schema versions.
 */
export class SchemaVersionHelper {
  constructor(
    private schemaManager: SchemaManager,
    private schemaHelper: SchemaHelper,
    private projectManager: ProjectManager,
    private registryChecks: RegistryChecks,
    private storage: Storage,
    private targetStore: TargetStore,
    private logger: Logger,
    private compositionOrchestrator: CompositionOrchestrator,
    private schemaVersions: SchemaVersionStore,
    private breakingSchemaChangesHelper: BreakingSchemaChangeUsageHelper,
  ) {}

  @traceFn('SchemaVersionHelper.composeSchemaVersion', {
    initAttributes: input => ({
      'hive.target.id': input.targetId,
      'hive.organization.id': input.organizationId,
      'hive.project.id': input.projectId,
      'hive.version.id': input.id,
    }),
  })
  @cache<SchemaVersion>(version => version.id)
  private async composeSchemaVersion(schemaVersion: SchemaVersion) {
    const [schemas, project, organization] = await Promise.all([
      this.schemaVersions.getSchemasBySchemaVersionId(schemaVersion.id),
      this.projectManager.getProjectById(schemaVersion.projectId),
      this.storage.getOrganization({
        organizationId: schemaVersion.organizationId,
      }),
    ]);

    if (schemas.length === 0) {
      return null;
    }

    const validation = await this.compositionOrchestrator.composeAndValidate(
      CompositionOrchestrator.projectTypeToOrchestratorType(project.type),
      schemas.map(s =>
        this.schemaHelper.createSchemaObject({
          sdl: s.sdl,
          serviceName: s.kind === 'composite' ? s.service_name : null,
          serviceUrl: s.kind === 'composite' ? s.service_url : null,
        }),
      ),
      {
        external: project.externalComposition,
        native: this.schemaManager.checkProjectNativeFederationSupport({
          project,
          organization,
          targetId: schemaVersion.targetId,
        }),
        contracts: null,
      },
    );

    return validation;
  }

  async getSchemaCompositionErrors(schemaVersion: SchemaVersion) {
    if (schemaVersion.hasPersistedSchemaChanges) {
      return schemaVersion.schemaCompositionErrors;
    }

    const composition = await this.composeSchemaVersion(schemaVersion);
    if (composition === null) {
      return null;
    }

    return composition.errors?.length ? composition.errors : null;
  }

  async getCompositeSchemaSdl(schemaVersion: SchemaVersion) {
    if (schemaVersion.hasPersistedSchemaChanges) {
      if (!schemaVersion.supergraphSDL) {
        return schemaVersion.compositeSchemaSDL;
      }

      return schemaVersion.compositeSchemaSDL
        ? this.autoFixCompositeSchemaSdl(schemaVersion.compositeSchemaSDL, schemaVersion.id)
        : null;
    }

    const composition = await this.composeSchemaVersion(schemaVersion);

    if (composition === null) {
      return null;
    }

    return composition.sdl ?? null;
  }

  async getSupergraphSdl(schemaVersion: SchemaVersion) {
    if (schemaVersion.hasPersistedSchemaChanges) {
      return schemaVersion.supergraphSDL;
    }

    const composition = await this.composeSchemaVersion(schemaVersion);
    if (composition === null) {
      return null;
    }

    return composition.supergraph ?? null;
  }

  @cache<SchemaVersion>(version => version.id)
  async getCompositeSchemaAst(schemaVersion: SchemaVersion) {
    const compositeSchemaSdl = await this.getCompositeSchemaSdl(schemaVersion);

    if (compositeSchemaSdl === null) {
      return null;
    }

    const compositeSchemaAst = parseGraphQLSource(
      compositeSchemaSdl,
      'SchemaVersionHelper.getCompositeSchemaAst: Composite',
    );

    return compositeSchemaAst;
  }

  @cache<SchemaVersion>(version => version.id)
  async getSupergraphAst(schemaVersion: SchemaVersion) {
    const compositeSchemaSdl = await this.getSupergraphSdl(schemaVersion);
    if (compositeSchemaSdl === null) {
      return null;
    }

    const supergraphAst = parseGraphQLSource(
      compositeSchemaSdl,
      'SchemaVersionHelper.getSupergraphAst: Supergraph',
    );

    return supergraphAst;
  }

  @traceFn('SchemaVersionHelper._getSchemaChanges', {
    initAttributes: input => ({
      'hive.target.id': input.targetId,
      'hive.organization.id': input.organizationId,
      'hive.project.id': input.projectId,
      'hive.version.id': input.id,
    }),
    resultAttributes: changes => ({
      'hive.breaking-changes.count': changes?.breaking?.length,
      'hive.safe-changes.count': changes?.safe?.length,
    }),
  })
  @cache<SchemaVersion>(version => version.id)
  private async _getSchemaChanges(schemaVersion: SchemaVersion) {
    if (!schemaVersion.isComposable) {
      return null;
    }

    if (schemaVersion.hasPersistedSchemaChanges) {
      const changes: null | Array<SchemaChangeType> =
        await this.schemaVersions.getSchemaSchangesForSchemaVersion(schemaVersion);

      const safeChanges: Array<SchemaChangeType> = [];
      const breakingChanges: Array<SchemaChangeType> = [];

      for (const change of changes ?? []) {
        if (change.criticality === CriticalityLevel.Breaking) {
          breakingChanges.push(change);
          if (schemaVersion.conditionalBreakingChangeMetadata) {
            this.breakingSchemaChangesHelper.registerMetadataForBreakingSchemaChange(
              change,
              schemaVersion.conditionalBreakingChangeMetadata,
            );
          }
          continue;
        }
        safeChanges.push(change);
      }

      return {
        breaking: breakingChanges.length ? breakingChanges : null,
        safe: safeChanges.length ? safeChanges : null,
        all: changes ?? null,
      };
    }

    const previousVersion = await this.getPreviousDiffableSchemaVersion(schemaVersion);

    if (!previousVersion) {
      return null;
    }

    const existingSdl = await this.getCompositeSchemaSdl(previousVersion);
    const incomingSdl = await this.getCompositeSchemaSdl(schemaVersion);

    const [schemaBefore, schemasAfter] = await Promise.all([
      this.schemaVersions.getSchemasBySchemaVersionId(schemaVersion.id),
      this.schemaVersions.getSchemasBySchemaVersionId(previousVersion.id),
    ]);

    if (!existingSdl || !incomingSdl) {
      return null;
    }

    const [
      project,
      { failDiffOnDangerousChange, failAllDangerousChanges, failDangerousChangeTypes },
    ] = await Promise.all([
      this.projectManager.getProjectById(schemaVersion.projectId),
      this.targetStore.getTargetSettings({
        targetId: schemaVersion.targetId,
        projectId: schemaVersion.projectId,
        organizationId: schemaVersion.organizationId,
      }),
    ]);

    const diffCheck = await this.registryChecks.diff({
      approvedChanges: null,
      existingSdl,
      incomingSdl,
      includeUrlChanges: {
        schemasBefore: ensureCompositeSchemas(schemaBefore).map(toCompositeSchemaInput),
        schemasAfter: ensureCompositeSchemas(schemasAfter).map(toCompositeSchemaInput),
      },
      filterOutFederationChanges: project.type === ProjectType.FEDERATION,
      conditionalBreakingChangeConfig: null,
      failDiffOnDangerousChange,
      failAllDangerousChanges,
      failDangerousChangeTypes: failDangerousChangeTypes ?? [],
      filterNestedChanges: true,
      getAffectedAppDeployments: null,
    });

    if (diffCheck.status === 'skipped') {
      return null;
    }

    return diffCheck.reason ?? diffCheck.result;
  }

  async getPreviousDiffableSchemaVersion(
    schemaVersion: SchemaVersion,
  ): Promise<SchemaVersion | null> {
    return await this.schemaManager.getComposableVersionBeforeVersionId(schemaVersion);
  }

  async getBreakingSchemaChanges(schemaVersion: SchemaVersion) {
    const changes = await this._getSchemaChanges(schemaVersion);
    return changes?.breaking ?? null;
  }

  async getSafeSchemaChanges(schemaVersion: SchemaVersion) {
    const changes = await this._getSchemaChanges(schemaVersion);
    return changes?.safe ?? null;
  }

  async getAllSchemaChanges(schemaVersion: SchemaVersion) {
    const changes = await this._getSchemaChanges(schemaVersion);
    return changes?.all ?? null;
  }

  async getHasSchemaChanges(schemaVersion: SchemaVersion) {
    const changes = await this._getSchemaChanges(schemaVersion);
    return !!changes?.breaking?.length || !!changes?.safe?.length;
  }

  async getIsFirstComposableVersion(schemaVersion: SchemaVersion) {
    if (!schemaVersion.isComposable) {
      return false;
    }

    if (schemaVersion.recordVersion === '2024-01-10') {
      return schemaVersion.diffSchemaVersionId === null;
    }

    if (schemaVersion.hasPersistedSchemaChanges) {
      const previousVersion = await this.getPreviousDiffableSchemaVersion(schemaVersion);
      if (previousVersion === null) {
        return true;
      }
    }

    const composableVersion =
      await this.schemaManager.getFirstComposableSchemaVersionBeforeSchemaVersion(schemaVersion);

    return !composableVersion;
  }

  @traceFn('SchemaVersionHelper.getServiceSdlForPreviousVersionService', {
    initAttributes: (schemaVersion, serviceName) => ({
      'hive.organization.id': schemaVersion.organizationId,
      'hive.project.id': schemaVersion.projectId,
      'hive.target.id': schemaVersion.targetId,
      'hive.version.id': schemaVersion.id,
      'hive.service.name': serviceName,
    }),
  })
  async getServiceSdlForPreviousVersionService(schemaVersion: SchemaVersion, serviceName: string) {
    const previousVersion = await this.getPreviousDiffableSchemaVersion(schemaVersion);
    if (!previousVersion) {
      return null;
    }

    const schemaLog = await this.schemaVersions.getServiceSchemaOfVersion(
      schemaVersion,
      serviceName,
    );

    return schemaLog?.sdl ?? null;
  }

  getIsValid(schemaVersion: SchemaVersion) {
    return schemaVersion.isComposable && schemaVersion.hasContractCompositionErrors === false;
  }

  async getGraphQLSubgraphDiffsForSchemaVersion(schemaVersion: SchemaVersion) {
    const project = await this.projectManager.getProjectById(schemaVersion.projectId);

    // For non multi-service projects we dont need a subgraph diff
    if (project.type === ProjectType.SINGLE) {
      return null;
    }

    this.logger.debug(
      'Generate subgraph diff for schema version. (schemaVersionId=%s)',
      schemaVersion.id,
    );

    const edges = await this.schemaVersions
      .getSchemaLogEdgesWithNodesForSchemaVersion(schemaVersion)
      .then(edges =>
        edges.sort((a, b) => {
          const aSubgraphName = a.subgraphName ?? '';
          const bSubgraphName = b.subgraphName ?? '';
          if (aSubgraphName < bSubgraphName) return -1;
          if (aSubgraphName > bSubgraphName) return 1;
          return 0;
        }),
      );

    const previousSchemaLogPromises: Array<Promise<void>> = [];
    const previousSchemaLogsById = new Map<string, SchemaLog>();

    for (const edge of edges) {
      if (edge.previousActionId && edge.actionId !== edge.previousActionId) {
        previousSchemaLogPromises.push(
          this.schemaVersions.getSchemaLogNodeByNodeId(edge.previousActionId).then(log => {
            previousSchemaLogsById.set(log.id, log);
          }),
        );
      }
    }

    await Promise.all(previousSchemaLogPromises);

    const revisionsBySchemaLogId = await this.schemaVersions.getSchemaRevisionsBySchemaLogIds([
      ...edges.map(edge => edge.node.id),
      ...previousSchemaLogsById.keys(),
    ]);

    return edges.map(edge => {
      if (edge.type === 'unchanged') {
        invariant(edge.node.kind === 'composite', 'Edge can not have other type than composite.');

        return {
          __typename: 'SubgraphDiffUnchanged',
          subgraphVersion: {
            id: edge.node.id,
            revision: revisionsBySchemaLogId.get(edge.node.id) ?? null,
            sdl: edge.node.sdl,
            serviceName: edge.node.service_name,
            url: edge.node.service_url,
          },
        } satisfies ResolversUnionTypes<any>['SubgraphDiff'];
      }
      if (edge.type === 'added') {
        invariant(!!edge.node.service_name, 'node of edge cannot be null');
        invariant(!!edge.node.service_url, 'url of edge cannot be null');

        return {
          __typename: 'SubgraphDiffAdded',
          subgraphVersion: {
            id: edge.node.id,
            revision: revisionsBySchemaLogId.get(edge.node.id) ?? null,
            sdl: edge.node.sdl,
            serviceName: edge.node.service_name,
            url: edge.node.service_url,
          },
        } satisfies ResolversUnionTypes<any>['SubgraphDiff'];
      }
      if (edge.type === 'changed') {
        invariant(edge.node.kind === 'composite', 'Edge can not have other type than composite.');

        const previousLog = previousSchemaLogsById.get(edge.previousActionId);

        invariant(previousLog != null, 'Previous log must exist.');
        invariant(previousLog.kind === 'composite', 'Edge can not have other type than composite.');
        invariant(previousLog.action === 'PUSH', 'Previous log must have PUSH action.');

        return {
          __typename: 'SubgraphDiffChanged',
          previousSubgraphVersion: {
            id: previousLog.id,
            revision: revisionsBySchemaLogId.get(previousLog.id) ?? null,
            sdl: previousLog.sdl,
            serviceName: previousLog.service_name,
            url: previousLog.service_url,
          },
          subgraphVersion: {
            id: edge.node.id,
            revision: revisionsBySchemaLogId.get(edge.node.id) ?? null,
            sdl: edge.node.sdl,
            serviceName: edge.node.service_name,
            url: edge.node.service_url,
          },
          changes: edge.schemaChanges,
        } satisfies ResolversUnionTypes<any>['SubgraphDiff'];
      }
      if (edge.type === 'removed') {
        const previousLog = previousSchemaLogsById.get(edge.previousActionId);

        invariant(previousLog != null, 'Previous log must exist.');
        invariant(previousLog.kind === 'composite', 'Edge can not have other type than composite.');
        invariant(previousLog.action === 'PUSH', 'Previous log must have PUSH action.');

        return {
          __typename: 'SubgraphDiffRemoved',
          removedSubgraphVersion: {
            id: previousLog.id,
            revision: revisionsBySchemaLogId.get(previousLog.id) ?? null,
            sdl: previousLog.sdl,
            serviceName: previousLog.service_name,
            url: previousLog.service_url,
          },
        } satisfies ResolversUnionTypes<any>['SubgraphDiff'];
      }

      edge satisfies never;
      invariant(false, 'Unexpected edge.');
    });
  }
  @cache((schemaVersion: SchemaVersion) => schemaVersion.id)
  async getGraphQLRegistryLogForSchemaVersion(schemaVersion: SchemaVersion) {
    let log: SchemaLog | null = null;

    if (schemaVersion.origin) {
      if (schemaVersion.origin.type === 'delete') {
        log = await this.schemaVersions.getSchemaLogById(
          schemaVersion.origin.services[0].versionId,
        );
      }

      if (schemaVersion.origin.type === 'publish') {
        let actionId = schemaVersion.origin.services?.[0].versionId;

        if (!actionId) {
          const schemas = await this.schemaVersions.getSchemasBySchemaVersionId(schemaVersion.id);
          if (schemas[0]) {
            actionId = schemas[0].id;
          }
        }

        if (actionId) {
          log = await this.schemaVersions.getSchemaLogById(actionId);
        }
      }

      if (schemaVersion.origin.type === 'promotion') {
        return {
          __typename: 'PromotionSchemaLog',
        } satisfies ResolversUnionTypes<any>['RegistryLog'];
      }
    }

    if (!log) {
      invariant(
        schemaVersion.actionId,
        `Schema version '${schemaVersion.id}' must have an action id if it has no origin.`,
      );
      log = await this.schemaVersions.getSchemaLogById(schemaVersion.actionId);
    }

    invariant(log != null, 'Could not find log.');

    if (log.kind === 'single') {
      return {
        __typename: 'PushedSchemaLog',
        author: log.author,
        commit: log.commit,
        date: log.date,
        id: log.id,
        service: null,
        serviceSdl: null,
      } satisfies ResolversUnionTypes<any>['RegistryLog'];
    }

    if (log.action === 'DELETE') {
      return {
        __typename: 'DeletedSchemaLog',
        date: log.date,
        id: log.id,
        deletedService: log.service_name,
        previousServiceSdl: await this.getServiceSdlForPreviousVersionService(
          schemaVersion,
          log.service_name,
        ),
      } satisfies ResolversUnionTypes<any>['RegistryLog'];
    }

    return {
      __typename: 'PushedSchemaLog',
      author: log.author,
      commit: log.commit,
      date: log.date,
      id: log.id,
      service: log.service_name,
      serviceSdl: log.sdl,
      previousServiceSdl: await this.getServiceSdlForPreviousVersionService(
        schemaVersion,
        log.service_name,
      ),
    } satisfies ResolversUnionTypes<any>['RegistryLog'];
  }

  async getGraphQLSchemaVersionOriginForSchemaVersion(schemaVersion: SchemaVersion) {
    const project = await this.projectManager.getProjectById(schemaVersion.projectId);

    if (schemaVersion.origin) {
      if (schemaVersion.origin.type === 'publish') {
        return {
          __typename: 'SchemaVersionPublishOrigin',
          revision: schemaVersion.origin.revision ?? null,
          publishedSubgraphs: schemaVersion.origin.services ?? null,
        } satisfies ResolversUnionTypes<any>['SchemaVersionOrigin'];
      }

      if (schemaVersion.origin.type === 'delete') {
        return {
          __typename: 'SchemaVersionSubgraphRemoveOrigin',
          removedSubgraphs: schemaVersion.origin.services ?? null,
        } satisfies ResolversUnionTypes<any>['SchemaVersionOrigin'];
      }

      if (schemaVersion.origin.type === 'promotion') {
        return {
          __typename: 'SchemaVersionPromoteOrigin',
          schemaVersionId: schemaVersion.origin.source.schemaVersion.id,
          targetId: schemaVersion.origin.source.target.id,
          targetSlug: schemaVersion.origin.source.target.name,
        } satisfies ResolversUnionTypes<any>['SchemaVersionOrigin'];
      }

      schemaVersion.origin satisfies never;
    }

    if (project.type === ProjectType.SINGLE) {
      return {
        __typename: 'SchemaVersionPublishOrigin',
        revision: null,
        publishedSubgraphs: null,
      } satisfies ResolversUnionTypes<any>['SchemaVersionOrigin'];
    }

    invariant(
      schemaVersion.actionId,
      `Schema version '${schemaVersion.id}' must have an action id if it has no origin.`,
    );
    const log = await this.schemaVersions.getSchemaLogNodeByNodeId(schemaVersion.actionId);
    invariant(log.service_name != null, 'Service name must be defined');

    if (log.action === 'PUSH') {
      return {
        __typename: 'SchemaVersionPublishOrigin',
        revision: null,
        publishedSubgraphs: [
          {
            name: log.service_name,
            versionId: log.id,
          },
        ],
      } satisfies ResolversUnionTypes<any>['SchemaVersionOrigin'];
    }
    if (log.action === 'DELETE') {
      return {
        __typename: 'SchemaVersionSubgraphRemoveOrigin',
        removedSubgraphs: [
          {
            name: log.service_name,
            versionId: log.id,
          },
        ],
      } satisfies ResolversUnionTypes<any>['SchemaVersionOrigin'];
    }

    log satisfies never;
    invariant(false, 'SchemaVersion either needs to have actionId or origin property.');
  }
  /**
   * There's a possibility that the composite schema SDL contains parts of the supergraph spec.
   *
   *
   * This is a problem because we want to show the public schema to the user, and the supergraph spec is not part of that.
   * This may happen when composite schema was produced with an old version of `transformSupergraphToPublicSchema`
   * or when supergraph sdl contained something new.
   *
   * This function will check if the SDL contains supergraph spec and if it does, it will transform it to public schema.
   *
   * ---
   *
   * There's also a possibility that the composite schema contains type extensions.
   * This is a problem, because other parts of the system may expect it to be clean from type extensions.
   *
   * This function will check for type system extensions and merge them into matching definitions.
   */
  private autoFixCompositeSchemaSdl(sdl: string, versionId: string): string {
    const isFederationV1Output = sdl.includes('@core');
    // Poor's man check for type extensions to avoid parsing the SDL if it's not necessary.
    // Checks if the `extend` keyword is followed by a space or a newline and it's not a part of a word.
    const hasPotentiallyTypeExtensions = /\bextend(?=[\s\n])/.test(sdl);

    /**
     * If the SDL is clean from Supergraph spec or it's an output of @apollo/federation, we don't need to transform it.
     * We ignore @apollo/federation, because we never really transformed the output of it to public schema.
     * Doing so might be a breaking change for some users (like: removed join__Graph type).
     */
    if (!isFederationV1Output && containsSupergraphSpec(sdl)) {
      this.logger.warn(
        'Composite schema SDL contains supergraph spec, transforming to public schema (versionId: %s)',
        versionId,
      );

      const transformedSdl = print(
        transformSupergraphToPublicSchema(parseGraphQLSource(sdl, 'autoFixCompositeSchemaSdl')),
      );

      this.logger.debug(
        transformedSdl === sdl
          ? 'Transformation did not change the original SDL'
          : 'Transformation changed the original SDL',
      );

      return transformedSdl;
    }

    /**
     * If the SDL has type extensions, we need to merge them into matching definitions.
     */
    if (hasPotentiallyTypeExtensions) {
      const schemaAst = parseGraphQLSource(sdl, 'autoFixCompositeSchemaSdl');
      const hasTypeExtensions = schemaAst.definitions.some(isTypeSystemExtensionNode);

      if (!hasTypeExtensions) {
        return sdl;
      }

      this.logger.warn(
        'Composite schema AST contains type extensions, merging them into matching definitions',
      );
      return print(mergeTypeDefs(schemaAst));
    }

    return sdl;
  }
}
