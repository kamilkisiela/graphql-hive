import { SLUGS } from './layouts';

const organization = {
  __typename: 'Organization' as const,
  id: 'organization-1',
  slug: SLUGS.organizationSlug,
  usageRetentionInDays: 30,
};

/** `TargetExplorerDeprecatedSchemaPageQuery` / `TargetExplorerUnusedSchemaPageQuery`: the gate for a target with usage. */
export function explorerGate(usageRetentionInDays = 30) {
  return {
    __typename: 'Query' as const,
    organization: { ...organization, usageRetentionInDays },
    hasCollectedOperations: true,
  };
}

// The retention must agree with the layout fixture's: both describe the same organization.
export function explorerFixtures(usageRetentionInDays = 30) {
  return new Map<string, unknown>([
    ['TargetExplorerDeprecatedSchemaPageQuery', explorerGate(usageRetentionInDays)],
    ['TargetExplorerUnusedSchemaPageQuery', explorerGate(usageRetentionInDays)],
  ]);
}

/** `TargetExplorerTypenamePageQuery` for a type the latest version lacks, or a target with no version. */
export function explorerTypeMissing(options: { hasVersion: boolean }) {
  return {
    __typename: 'Query' as const,
    organization,
    target: {
      __typename: 'Target' as const,
      id: 'target-1',
      slug: SLUGS.targetSlug,
      latestSchemaVersion: options.hasVersion
        ? {
            __typename: 'SchemaVersion' as const,
            id: 'version-42',
            explorer: {
              __typename: 'SchemaExplorer' as const,
              subgraphNames: [],
              metadataAttributes: [],
              type: null,
            },
          }
        : null,
      project: { __typename: 'Project' as const, id: 'project-1', type: 'FEDERATION' },
      operationsStats: { __typename: 'OperationsStats' as const, totalRequests: 0 },
    },
  };
}
