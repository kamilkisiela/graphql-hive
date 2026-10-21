import { parseDateRangeInput } from '../../../shared/helpers';
import { GraphStore } from '../../graph/providers/graph-store';
import { OperationsManager } from '../../operations/providers/operations-manager';
import { isFieldRequestedDeep } from '../lib/graphql-info-helper';
import { ContractsManager } from '../providers/contracts-manager';
import { SchemaManager } from '../providers/schema-manager';
import { toGraphQLSchemaCheck, toGraphQLSchemaCheckCurry } from '../to-graphql-schema-check';
import type { TargetResolvers } from './../../../__generated__/types';

export const Target: Pick<
  TargetResolvers,
  | 'baseSchema'
  | 'contracts'
  | 'fieldLevelMetricsDisplayState'
  | 'hasCollectedSubscriptionOperations'
  | 'hasSchema'
  | 'latestSchemaVersion'
  | 'latestValidSchemaVersion'
  | 'schemaCheck'
  | 'schemaCheckServiceNames'
  | 'schemaChecks'
  | 'schemaVersion'
  | 'schemaVersions'
  | 'schemaVersionsCount'
> = {
  schemaVersions: async (target, args, { injector }, info) => {
    const graph = await injector.get(GraphStore).getDefaultGraphForTargetId(target.id);
    return injector.get(SchemaManager).getPaginatedSchemaVersionsForGraph(graph, {
      cursor: args.after ?? null,
      first: args.first ?? null,
      withSDL: isSchemaVersionSDLRequested(info),
      withChanges: isFieldRequestedDeep(info, [['SchemaVersion', 'supergraphChanges']]),
    });
  },
  async schemaVersion(target, args, { injector }) {
    const graph = await injector.get(GraphStore).getDefaultGraphForTargetId(target.id);
    return await injector.get(SchemaManager).getSchemaVersionForGraphById(graph, args.id);
  },
  async latestSchemaVersion(target, _, { injector }) {
    const graph = await injector.get(GraphStore).getDefaultGraphForTargetId(target.id);
    return injector.get(SchemaManager).getMaybeLatestVersionForGraph(graph);
  },
  async latestValidSchemaVersion(target, __, { injector }) {
    const graph = await injector.get(GraphStore).getDefaultGraphForTargetId(target.id);
    return injector.get(SchemaManager).getMaybeLatestValidVersionForGraph(graph);
  },
  baseSchema: (target, _, { injector }) => {
    return injector.get(SchemaManager).getBaseSchemaForTarget(target);
  },
  hasSchema: (target, _, { injector }) => {
    return injector.get(SchemaManager).hasPublishedSchemaVersionInDefaultGraph(target);
  },
  schemaCheck: async (target, args, { injector }, info) => {
    const schemaCheck = await injector
      .get(SchemaManager)
      .findSchemaCheckForTarget(target, args.id, {
        withSDL: isSDLRequested(info),
        withChanges: areSchemaCheckChangesRequested(info),
      });

    if (schemaCheck == null) {
      return null;
    }

    return toGraphQLSchemaCheck(
      {
        organizationId: target.orgId,
        projectId: target.projectId,
      },
      schemaCheck,
    );
  },
  schemaChecks: async (target, args, { injector }, info) => {
    const operationSelectsSDL = isSDLRequested(info);

    const isSchemaChangesSelected = areSchemaCheckChangesRequested(info);

    const result = await injector.get(SchemaManager).getPaginatedSchemaChecksForTarget(target, {
      first: args.first ?? null,
      cursor: args.after ?? null,
      filters: args.filters ?? null,
      transformNode: toGraphQLSchemaCheckCurry({
        organizationId: target.orgId,
        projectId: target.projectId,
      }),
      withSDL: operationSelectsSDL,
      withChanges: isSchemaChangesSelected,
    });

    return {
      edges: result.items,
      pageInfo: result.pageInfo,
    };
  },
  async schemaVersionsCount(target, { period }, { injector }) {
    const graph = await injector.get(GraphStore).getDefaultGraphForTargetId(target.id);
    return injector
      .get(SchemaManager)
      .countSchemaVersionsOfGraph(graph, period ? parseDateRangeInput(period) : null);
  },
  contracts: async (target, args, { injector }) => {
    const graph = await injector.get(GraphStore).getDefaultGraphForTargetId(target.id);

    return await injector.get(ContractsManager).getPaginatedContractGraphsForGraph(graph, {
      cursor: args.after ?? null,
      first: args.first ?? null,
    });
  },
  hasCollectedSubscriptionOperations: async (target, _, { injector }) => {
    return await injector.get(OperationsManager).hasCollectedSubscriptionOperations({
      targetId: target.id,
      projectId: target.projectId,
      organizationId: target.orgId,
    });
  },
  fieldLevelMetricsDisplayState: async (target, _, { injector }) => {
    return injector.get(OperationsManager).fieldLevelMetricsDisplayState({
      organizationId: target.orgId,
      targetId: target.id,
    });
  },
  schemaCheckServiceNames: (target, _, { injector }) => {
    return injector.get(SchemaManager).getSchemaCheckServiceNamesForTarget(target);
  },
};

/** Whether the operation reads a check's SDLs, its own or its baseline's. */
export function isSDLRequested(info: Parameters<typeof isFieldRequestedDeep>[0]) {
  return isFieldRequestedDeep(info, [
    ...['SchemaCheck', 'SuccessfulSchemaCheck', 'FailedSchemaCheck'].flatMap(typeName =>
      ['schemaSDL', 'previousSchemaSDL', 'compositeSchemaSDL', 'supergraphSDL'].map(
        fieldName => [typeName, fieldName] as const,
      ),
    ),
    ...['sdl', 'publicSdl', 'supergraphSdl'].map(
      fieldName => ['SchemaCheckBaseline', fieldName] as const,
    ),
  ]);
}

export function isSchemaVersionSDLRequested(info: Parameters<typeof isFieldRequestedDeep>[0]) {
  return isFieldRequestedDeep(
    info,
    ['sdl', 'supergraph', 'explorer', 'unusedSchema', 'deprecatedSchema'].map(
      fieldName => ['SchemaVersion', fieldName] as const,
    ),
  );
}

export function areSchemaCheckChangesRequested(info: Parameters<typeof isFieldRequestedDeep>[0]) {
  return isFieldRequestedDeep(
    info,
    ['SchemaCheck', 'SuccessfulSchemaCheck', 'FailedSchemaCheck'].flatMap(typeName =>
      [
        'schemaChanges',
        'safeSchemaChanges',
        'breakingSchemaChanges',
        'safeSchemaChangeGroups',
        'unapprovedBreakingSchemaChangeCount',
        'cliApprovalMetadata',
      ].map(fieldName => [typeName, fieldName] as const),
    ),
  );
}
