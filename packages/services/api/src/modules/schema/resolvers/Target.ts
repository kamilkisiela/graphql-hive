import { parseDateRangeInput } from '../../../shared/helpers';
import { OperationsManager } from '../../operations/providers/operations-manager';
import { ContractsManager } from '../providers/contracts-manager';
import { SchemaManager } from '../providers/schema-manager';
import { toGraphQLSchemaCheck, toGraphQLSchemaCheckCurry } from '../to-graphql-schema-check';
import type { TargetResolvers } from './../../../__generated__/types.next';

export const Target: Pick<
  TargetResolvers,
  | 'activeContracts'
  | 'baseSchema'
  | 'contracts'
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
  schemaVersions: async (target, args, { injector }) => {
    return injector.get(SchemaManager).getPaginatedSchemaVersionsForTargetId({
      targetId: target.id,
      organizationId: target.orgId,
      projectId: target.projectId,
      cursor: args.after ?? null,
      first: args.first ?? null,
    });
  },
  schemaVersion: async (target, args, { injector }) => {
    const schemaVersion = await injector.get(SchemaManager).getSchemaVersion({
      organization: target.orgId,
      project: target.projectId,
      target: target.id,
      version: args.id,
    });

    if (schemaVersion === null) {
      return null;
    }

    return {
      ...schemaVersion,
      organization: target.orgId,
      project: target.projectId,
      target: target.id,
    };
  },
  latestSchemaVersion: (target, _, { injector }) => {
    return injector.get(SchemaManager).getMaybeLatestVersion({
      target: target.id,
      project: target.projectId,
      organization: target.orgId,
    });
  },
  latestValidSchemaVersion: async (target, __, { injector }) => {
    return injector.get(SchemaManager).getMaybeLatestValidVersion({
      organization: target.orgId,
      project: target.projectId,
      target: target.id,
    });
  },
  baseSchema: (target, _, { injector }) => {
    return injector.get(SchemaManager).getBaseSchema({
      target: target.id,
      project: target.projectId,
      organization: target.orgId,
    });
  },
  hasSchema: (target, _, { injector }) => {
    return injector.get(SchemaManager).hasSchema({
      target: target.id,
      project: target.projectId,
      organization: target.orgId,
    });
  },
  schemaCheck: async (target, args, { injector }) => {
    const schemaCheck = await injector.get(SchemaManager).findSchemaCheck({
      targetId: target.id,
      projectId: target.projectId,
      organizationId: target.orgId,
      schemaCheckId: args.id,
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
  schemaChecks: async (target, args, { injector }) => {
    const result = await injector.get(SchemaManager).getPaginatedSchemaChecksForTarget({
      targetId: target.id,
      projectId: target.projectId,
      organizationId: target.orgId,
      first: args.first ?? null,
      cursor: args.after ?? null,
      filters: args.filters ?? null,
      transformNode: toGraphQLSchemaCheckCurry({
        organizationId: target.orgId,
        projectId: target.projectId,
      }),
    });

    return {
      edges: result.items,
      pageInfo: result.pageInfo,
    };
  },
  schemaVersionsCount: (target, { period }, { injector }) => {
    return injector.get(SchemaManager).countSchemaVersionsOfTarget({
      organization: target.orgId,
      project: target.projectId,
      target: target.id,
      period: period ? parseDateRangeInput(period) : null,
    });
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
      target: target.id,
      project: target.projectId,
      organization: target.orgId,
    });
  },
};
