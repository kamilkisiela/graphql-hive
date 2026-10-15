import { CriticalityLevel as CriticalityLevelEnum } from '@graphql-inspector/core';
import { BreakingSchemaChangeUsageHelper } from '../providers/breaking-schema-changes-helper';
import type {
  CriticalityLevel,
  SchemaChangeResolvers,
  SeverityLevelType,
} from './../../../__generated__/types';

const criticalityMap: Record<CriticalityLevelEnum, CriticalityLevel> = {
  [CriticalityLevelEnum.Breaking]: 'Breaking',
  [CriticalityLevelEnum.NonBreaking]: 'Safe',
  [CriticalityLevelEnum.Dangerous]: 'Dangerous',
};

const severityMap: Record<CriticalityLevelEnum, SeverityLevelType> = {
  [CriticalityLevelEnum.NonBreaking]: 'SAFE',
  [CriticalityLevelEnum.Dangerous]: 'DANGEROUS',
  [CriticalityLevelEnum.Breaking]: 'BREAKING',
};

export const SchemaChange: Pick<
  SchemaChangeResolvers,
  | 'affectedAppDeployments'
  | 'approval'
  | 'criticality'
  | 'criticalityReason'
  | 'isSafeBasedOnUsage'
  | 'message'
  | 'path'
  | 'severityLevel'
  | 'severityReason'
  | 'usageStatistics'
> = {
  message: (change, args) => {
    return args.withSafeBasedOnUsageNote && change.isSafeBasedOnUsage === true
      ? `${change.message} (non-breaking based on usage)`
      : change.message;
  },
  path: change => change.path?.split('.') ?? null,
  criticality: change => criticalityMap[change.criticality],
  criticalityReason: change => change.reason,
  approval: change => change.approvalMetadata,
  isSafeBasedOnUsage: change => change.isSafeBasedOnUsage,
  usageStatistics: (change, _, { injector }) =>
    injector.get(BreakingSchemaChangeUsageHelper).getUsageDataForBreakingSchemaChange(change),
  severityLevel: change => severityMap[change.criticality],
  severityReason: change => change.reason,
  affectedAppDeployments: (change, args) => {
    if (change.affectedAppDeployments === null) {
      return null;
    }

    const allDeployments = change.affectedAppDeployments;
    const totalCount = allDeployments.length;

    // Apply cursor-based pagination
    let startIndex = 0;
    if (args.after) {
      const afterIndex = allDeployments.findIndex(d => d.id === args.after);
      if (afterIndex !== -1) {
        startIndex = afterIndex + 1;
      }
    }

    const limit = args.first;
    const paginatedDeployments =
      limit != null
        ? allDeployments.slice(startIndex, startIndex + limit)
        : allDeployments.slice(startIndex);

    const edges = paginatedDeployments.map(d => ({
      cursor: d.id,
      node: {
        id: d.id,
        name: d.name,
        version: d.version,
        createdAt: d.createdAt ?? null,
        activatedAt: d.activatedAt ?? null,
        retiredAt: d.retiredAt ?? null,
        status: d.retiredAt ? ('retired' as const) : ('active' as const),
        operations: d.affectedOperations,
        totalOperations: d.affectedOperations.length,
      },
    }));

    const hasNextPage = limit != null ? startIndex + limit < totalCount : false;

    return {
      edges,
      totalCount,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: startIndex > 0,
        startCursor: edges[0]?.cursor ?? '',
        endCursor: edges[edges.length - 1]?.cursor ?? '',
      },
    };
  },
};
