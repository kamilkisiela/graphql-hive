import { parseDateRangeInput } from '../../../shared/helpers';
import { OperationsManager } from '../../operations/providers/operations-manager';
import { isFieldRequestedDeep } from '../lib/is-field-requested';
import { ContractsManager } from '../providers/contracts-manager';
import { SchemaManager } from '../providers/schema-manager';
import { SchemaVersionStore } from '../providers/schema-version-store';
import { toGraphQLSchemaCheck, toGraphQLSchemaCheckCurry } from '../to-graphql-schema-check';
import type { TargetResolvers } from './../../../__generated__/types';

export const Target: Pick<
  TargetResolvers,
  | 'activeContracts'
  | 'baseSchema'
  | 'contracts'
  | 'fieldLevelMetricsDisplayState'
  | 'hasCollectedSubscriptionOperations'
  | 'hasSchema'
  | 'latestSchemaVersion'
  | 'latestValidSchemaVersion'
  | 'schemaCheck'
  | 'schemaChecks'
  | 'schemaVersion'
  | 'schemaVersions'
  | 'schemaVersionsCount'
> = {
  schemaVersions: async (target, args, { injector }, info) => {
    const withSchemaChanges = isFieldRequestedDeep(info, [
      ['SchemaVersion', 'hasSchemaChanges'],
      ['SchemaVersion', 'schemaChanges'],
      ['SchemaVersion', 'breakingSchemaChanges'],
      ['SchemaVersion', 'safeSchemaChanges'],
    ]);
    const withSDL = isFieldRequestedDeep(info, [
      ['SchemaVersion', 'sdl'],
      ['SchemaVersion', 'supergraph'],
      ['SchemaVersion', 'explorer'],
      ['SchemaVersion', 'unusedSchema'],
      ['SchemaVersion', 'deprecatedSchema'],
    ]);

    return injector.get(SchemaManager).getPaginatedSchemaVersionsForTargetId(target, {
      cursor: args.after ?? null,
      first: args.first ?? null,
      withSchemaChanges,
      withSDL,
    });
  },
  schemaVersion: async (target, args, { injector }) => {
    return await injector.get(SchemaManager).getSchemaVersionBySelector({
      organizationId: target.orgId,
      projectId: target.projectId,
      targetId: target.id,
      versionId: args.id,
    });
  },
  latestSchemaVersion: (target, _, { injector }) => {
    return injector.get(SchemaManager).getMaybeLatestVersion(target);
  },
  latestValidSchemaVersion: async (target, __, { injector }) => {
    return injector.get(SchemaManager).getMaybeLatestValidVersion(target);
  },
  baseSchema: (target, _, { injector }) => {
    return injector.get(SchemaManager).getBaseSchemaForTarget(target);
  },
  hasSchema: (target, _, { injector }) => {
    return injector.get(SchemaVersionStore).anyVersionExistsForTarget(target);
  },
  schemaCheck: async (target, args, { injector }) => {
    const schemaCheck = await injector.get(SchemaManager).findSchemaCheckForTarget(target, args.id);

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
    const operationSelectsSDL = isFieldRequestedDeep(info, [
      ['SchemaCheck', 'baseline'],
      ['SuccessfulSchemaCheck', 'baseline'],
      ['FailedSchemaCheck', 'baseline'],
      ['SuccessfulSchemaCheck', 'schemaSDL'],
      ['SuccessfulSchemaCheck', 'compositeSchemaSDL'],
      ['SuccessfulSchemaCheck', 'supergraphSDL'],
      ['FailedSchemaCheck', 'compositeSchemaSDL'],
      ['FailedSchemaCheck', 'supergraphSDL'],
      ['FailedSchemaCheck', 'schemaSDL'],
    ]);

    const isSchemaChangesSelected = isFieldRequestedDeep(info, [
      ['SuccessfulSchemaCheck', 'safeSchemaChanges'],
      ['SuccessfulSchemaCheck', 'breakingSchemaChanges'],
      ['FailedSchemaCheck', 'safeSchemaChanges'],
      ['FailedSchemaCheck', 'breakingSchemaChanges'],
    ]);

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
  schemaVersionsCount: (target, { period }, { injector }) => {
    return injector
      .get(SchemaManager)
      .countSchemaVersionsOfTarget(target, period ? parseDateRangeInput(period) : null);
  },
  contracts: async (target, args, { injector }) => {
    return await injector.get(ContractsManager).getPaginatedContractsForTarget({
      target,
      cursor: args.after ?? null,
      first: args.first ?? null,
    });
  },
  activeContracts: async (target, args, { injector }) => {
    return await injector.get(ContractsManager).getPaginatedActiveContractsForTarget({
      target,
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
};
