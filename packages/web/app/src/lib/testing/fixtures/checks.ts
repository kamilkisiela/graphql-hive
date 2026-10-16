import { CHANGES_PAGE_SIZE } from '@/components/target/history/change-page-size';

const TARGET_ID = 'target-1';

type Variables = {
  after?: string | null;
  filters?: { changed?: boolean; failed?: boolean; serviceName?: string | null };
};

function check(id: string, commit: string, failed = false, serviceName: string | null = null) {
  return {
    __typename: failed ? ('FailedSchemaCheck' as const) : ('SuccessfulSchemaCheck' as const),
    id,
    createdAt: '2026-09-27T10:00:00.000Z',
    serviceName,
    meta: { __typename: 'SchemaCheckMeta' as const, commit, author: 'User' },
    githubRepository: null,
  };
}

function page(nodes: ReturnType<typeof check>[], endCursor: string | null) {
  return {
    __typename: 'SchemaCheckConnection' as const,
    edges: nodes.map(node => ({ __typename: 'SchemaCheckEdge' as const, node })),
    pageInfo: {
      __typename: 'PageInfo' as const,
      hasNextPage: endCursor !== null,
      hasPreviousPage: false,
      endCursor,
    },
  };
}

/**
 * Three checks over two pages. The failed filter shows page one's failed check and one more that
 * only it returns, so a spec can tell the filtered page from what was already on screen. The
 * service filter returns a single check that no other page has, tagged with the requested service.
 */
export const CHECKS = {
  first: ['a1b2c3d', 'b2c3d4e'],
  second: ['c3d4e5f'],
  failedOnly: 'f4i1l3d',
  serviceOnly: '5e7v1ce',
  /** The open check's own commit, which no list row shows. */
  active: 'ac71v3c',
  nextCursor: 'cursor-2',
} as const;

/** The services of the latest valid version, as `ChecksPageQuery` returns them. */
export const SERVICES = ['products', 'users'] as const;

/** `SchemaChecks_NavigationQuery`, answered per page and filter. */
export function schemaChecksNavigation(variables: Variables) {
  const serviceName = variables.filters?.serviceName;
  const schemaChecks = serviceName
    ? page([check('check-5', CHECKS.serviceOnly, false, serviceName)], null)
    : variables.filters?.failed
      ? page(
          [check('check-2', CHECKS.first[1], true), check('check-4', CHECKS.failedOnly, true)],
          null,
        )
      : variables.after
        ? page([check('check-3', CHECKS.second[0])], null)
        : page(
            [
              check('check-1', CHECKS.first[0], false, SERVICES[1]),
              check('check-2', CHECKS.first[1], true),
            ],
            CHECKS.nextCursor,
          );
  return {
    __typename: 'Query' as const,
    target: { __typename: 'Target' as const, id: TARGET_ID, schemaChecks },
  };
}

type ProjectType = 'FEDERATION' | 'SINGLE';

/** `ChecksPageQuery` for a target that has checks; a federation target unless told otherwise. */
export function checksPage(projectType: ProjectType = 'FEDERATION') {
  return {
    __typename: 'Query' as const,
    target: {
      __typename: 'Target' as const,
      id: TARGET_ID,
      project: { __typename: 'Project' as const, id: 'project-1', type: projectType },
      latestValidSchemaVersion: {
        __typename: 'SchemaVersion' as const,
        id: 'version-1',
        serviceNames: projectType === 'SINGLE' ? null : [...SERVICES],
      },
      schemaChecks: {
        __typename: 'SchemaCheckConnection' as const,
        edges: [
          {
            __typename: 'SchemaCheckEdge' as const,
            node: { __typename: 'SuccessfulSchemaCheck' as const, id: 'check-1' },
          },
        ],
      },
    },
  };
}

/**
 * `ActiveSchemaCheck_ActiveSchemaCheckQuery`: a passing check with nothing to report, so the
 * detail renders its header and empty sections. Both check types share one `SchemaCheck:<id>`
 * cache entity, so request it at an id the list does not show or it rewrites that row.
 */
export function activeSchemaCheck(variables: { schemaCheckId: string }) {
  return {
    __typename: 'Query' as const,
    project: {
      __typename: 'Project' as const,
      id: 'project-1',
      type: 'FEDERATION',
      target: {
        __typename: 'Target' as const,
        id: TARGET_ID,
        schemaCheck: {
          __typename: 'SuccessfulSchemaCheck' as const,
          id: variables.schemaCheckId,
          serviceName: SERVICES[0],
          contextId: null,
          createdAt: '2026-09-27T10:00:00.000Z',
          meta: { __typename: 'SchemaCheckMeta' as const, commit: CHECKS.active, author: 'User' },
          isApproved: false,
          approvedBy: null,
          cliApprovalMetadata: null,
          approvalComment: null,
          contractChecks: null,
          hasSchemaCompositionErrors: false,
          hasSchemaChanges: false,
          hasUnapprovedBreakingChanges: false,
          baseline: null,
          unapprovedBreakingSchemaChangeCount: 0,
          breakingSchemaChanges: null,
          safeSchemaChangeGroups: [],
          schemaPolicyWarnings: null,
          schemaPolicyErrors: null,
          conditionalBreakingChangeMetadata: null,
        },
      },
    },
  };
}

export function checksFixtures(projectType?: ProjectType) {
  return new Map<string, unknown>([
    ['ChecksPageQuery', checksPage(projectType)],
    ['SchemaChecks_NavigationQuery', schemaChecksNavigation],
  ]);
}

const DAY = 86_400_000;

// Relative to now so the window stays inside the fixture org's 30 days of retention.
export const BREAKING_PERIOD = {
  from: new Date(Date.now() - 7 * DAY).toISOString(),
  to: new Date(Date.now() - DAY).toISOString(),
};

const breakingTargets = ['production', 'staging'].map(slug => ({
  __typename: 'BreakingChangeMetadataTarget' as const,
  id: `${slug}-id`,
  slug,
  target: { __typename: 'Target' as const, id: `${slug}-id`, slug },
}));

const productionUsage = {
  __typename: 'SchemaChangeUsageStatisticsAffectedTarget' as const,
  target: breakingTargets[0],
  count: 2,
  countFormatted: '2',
};

/** One breaking change used in production. `withTargets: false` predates per-target counts. */
export function breakingSchemaCheck(
  variables: { schemaCheckId: string },
  options: { withTargets?: boolean; safe?: boolean; noTargetUsage?: boolean } = {},
) {
  const withTargets = options.withTargets ?? true;
  const active = activeSchemaCheck(variables);
  return {
    ...active,
    project: {
      ...active.project,
      target: {
        ...active.project.target,
        schemaCheck: {
          ...active.project.target.schemaCheck,
          hasSchemaChanges: true,
          hasUnapprovedBreakingChanges: true,
          unapprovedBreakingSchemaChangeCount: options.safe ? 0 : 1,
          breakingSchemaChanges: {
            __typename: 'SchemaChangeConnection' as const,
            totalCount: 1,
            edges: [
              {
                __typename: 'SchemaChangeEdge' as const,
                node: {
                  __typename: 'SchemaChange' as const,
                  path: ['Query', 'products'],
                  message: "Field 'products' was removed from object type 'Query'",
                  severityLevel: 'BREAKING',
                  severityReason: null,
                  approval: null,
                  isSafeBasedOnUsage: options.safe ?? false,
                  usageTracking: 'TRACKED',
                  kind: 'FIELD_REMOVED',
                  usageStatistics: {
                    __typename: 'SchemaChangeUsageStatistics' as const,
                    topAffectedOperations: [
                      {
                        __typename: 'SchemaChangeUsageStatisticsAffectedOperation' as const,
                        hash: 'abcd1234',
                        name: 'Products',
                        countFormatted: '1',
                        percentageFormatted: '<0.01%',
                        affectedTargets: withTargets ? [productionUsage] : null,
                      },
                    ],
                    topAffectedClients: [
                      {
                        __typename: 'SchemaChangeUsageStatisticsAffectedClient' as const,
                        name: 'webapp',
                        countFormatted: '1',
                        percentageFormatted: '<0.01%',
                      },
                    ],
                    affectedTargets: !withTargets
                      ? null
                      : options.noTargetUsage
                        ? []
                        : [{ ...productionUsage, operationCount: 1 }],
                    schemaCoordinate: withTargets ? 'Query.products' : null,
                  },
                  affectedAppDeployments: null,
                },
              },
            ],
          },
          conditionalBreakingChangeMetadata: {
            __typename: 'SchemaCheckConditionalBreakingChangeMetadata' as const,
            period: { __typename: 'DateRange' as const, ...BREAKING_PERIOD },
            settings: {
              __typename: 'SchemaCheckConditionalBreakingChangeMetadataSettings' as const,
              retentionInDays: 7,
              percentage: 0,
              excludedClientNames: null,
              targets: breakingTargets,
            },
            usage: {
              __typename: 'SchemaCheckConditionalBreakingChangeMetadataUsage' as const,
              totalRequestCountFormatted: '1',
            },
          },
        },
      },
    },
  };
}

/** A check that failed only on schema policy errors. */
export function policyFailedSchemaCheck(variables: { schemaCheckId: string }) {
  const active = activeSchemaCheck(variables);
  const policyError = (message: string) => ({
    __typename: 'SchemaPolicyWarningEdge' as const,
    node: {
      __typename: 'SchemaPolicyWarning' as const,
      message,
      ruleId: 'require-deprecation-reason',
      start: { __typename: 'CodePosition' as const, line: 1, column: 1 },
      end: { __typename: 'CodePosition' as const, line: 1, column: 10 },
    },
  });
  return {
    ...active,
    project: {
      ...active.project,
      target: {
        ...active.project.target,
        schemaCheck: {
          ...active.project.target.schemaCheck,
          __typename: 'FailedSchemaCheck' as const,
          canBeApproved: true,
          canBeApprovedByViewer: true,
          hasSchemaChanges: true,
          compositionErrors: null,
          schemaPolicyErrors: {
            __typename: 'SchemaPolicyWarningConnection' as const,
            edges: [
              policyError('Deprecation reason is required'),
              policyError('Object type is unreachable'),
            ],
          },
        },
      },
    },
  };
}

const PAGE_SIZE = CHANGES_PAGE_SIZE;

// Inspector's reason for removing a field that was not deprecated.
const FIELD_REMOVED_REASON =
  'Removing a field is a breaking change. It is preferable to deprecate the field before removing it. This applies to removed union fields as well, since removal breaks client operations that contain fragments that reference the removed type through direct (... on RemovedType) or indirect means such as __typename in the consumers.';

/** A breaking removal of `StressType_<n>.value7`, without usage data. */
function removedFieldAt(index: number) {
  return {
    __typename: 'SchemaChange' as const,
    path: [`StressType_${index}`, 'value7'],
    message: `Field 'value7' was removed from object type 'StressType_${index}'`,
    severityLevel: 'BREAKING',
    severityReason: FIELD_REMOVED_REASON,
    approval: null,
    isSafeBasedOnUsage: false,
    usageTracking: 'TRACKED',
    kind: 'FIELD_REMOVED',
    usageStatistics: null,
    affectedAppDeployments: null,
  };
}

/** A safe change of `kind` on `StressType_<n>`. */
function safeChangeAt(kind: string, index: number) {
  return {
    __typename: 'SchemaChange' as const,
    path: [`StressType_${index}`],
    message:
      kind === 'TYPE_ADDED'
        ? `Type 'StressType_${index}' was added`
        : `Description 'old' on type 'StressType_${index}' has changed to 'new'`,
    severityLevel: 'SAFE',
    severityReason: null,
    approval: null,
    isSafeBasedOnUsage: false,
    usageTracking: 'NOT_TRACKED',
    kind,
  };
}

function edgesOf<T>(nodes: T[]) {
  return nodes.map(node => ({ __typename: 'SchemaChangeEdge' as const, node }));
}

function pageOf<T>(offset: number, total: number, at: (index: number) => T) {
  return Array.from({ length: Math.max(0, Math.min(PAGE_SIZE, total - offset)) }, (_, index) =>
    at(offset + index),
  );
}

/** Group sizes and the breaking total of `manyChangesSchemaCheck`. */
// Two full pages and a partial third, whatever the page size.
const THREE_PAGES = CHANGES_PAGE_SIZE * 2 + 20;
export const MANY_CHANGES = { breaking: THREE_PAGES, typeAdded: 2, descriptions: THREE_PAGES };

const groupTotals: Record<string, number> = {
  TYPE_ADDED: MANY_CHANGES.typeAdded,
  TYPE_DESCRIPTION_CHANGED: MANY_CHANGES.descriptions,
};

/** A failed check with 120 breaking changes and two safe groups, one long enough to page. */
export function manyChangesSchemaCheck(variables: { schemaCheckId: string }) {
  const active = activeSchemaCheck(variables);
  return {
    ...active,
    project: {
      ...active.project,
      target: {
        ...active.project.target,
        schemaCheck: {
          ...active.project.target.schemaCheck,
          __typename: 'FailedSchemaCheck' as const,
          canBeApproved: true,
          canBeApprovedByViewer: true,
          compositionErrors: null,
          hasSchemaChanges: true,
          hasUnapprovedBreakingChanges: true,
          unapprovedBreakingSchemaChangeCount: MANY_CHANGES.breaking,
          breakingSchemaChanges: {
            __typename: 'SchemaChangeConnection' as const,
            totalCount: MANY_CHANGES.breaking,
            edges: edgesOf(pageOf(0, MANY_CHANGES.breaking, removedFieldAt)),
          },
          safeSchemaChangeGroups: Object.entries(groupTotals).map(([kind, totalCount]) => ({
            __typename: 'SchemaChangeGroup' as const,
            kind,
            totalCount,
            changes: {
              __typename: 'SchemaChangeConnection' as const,
              edges: edgesOf(pageOf(0, totalCount, index => safeChangeAt(kind, index))),
            },
          })),
        },
      },
    },
  };
}

/** `CheckBreakingChangesPageQuery` for `manyChangesSchemaCheck`. */
export function breakingChangesPage(variables: { schemaCheckId: string; offset: number }) {
  return {
    __typename: 'Query' as const,
    target: {
      __typename: 'Target' as const,
      id: TARGET_ID,
      schemaCheck: {
        __typename: 'FailedSchemaCheck' as const,
        id: variables.schemaCheckId,
        breakingSchemaChanges: {
          __typename: 'SchemaChangeConnection' as const,
          edges: edgesOf(pageOf(variables.offset, MANY_CHANGES.breaking, removedFieldAt)),
        },
      },
    },
  };
}

/** `CheckSafeChangesPageQuery` for `manyChangesSchemaCheck`. */
export function safeChangesPage(variables: {
  schemaCheckId: string;
  kind: string;
  offset: number;
}) {
  const total = groupTotals[variables.kind] ?? 0;
  return {
    __typename: 'Query' as const,
    target: {
      __typename: 'Target' as const,
      id: TARGET_ID,
      schemaCheck: {
        __typename: 'FailedSchemaCheck' as const,
        id: variables.schemaCheckId,
        safeSchemaChangeGroups: [
          {
            __typename: 'SchemaChangeGroup' as const,
            kind: variables.kind,
            changes: {
              __typename: 'SchemaChangeConnection' as const,
              edges: edgesOf(
                pageOf(variables.offset, total, index => safeChangeAt(variables.kind, index)),
              ),
            },
          },
        ],
      },
    },
  };
}

const PRODUCTS_SDL = 'type Query { products: [String!]! }';

/** `CheckSdlQuery`: the SDLs a schema tab loads when it first opens. */
export function checkSdl(variables: { schemaCheckId: string }) {
  return {
    __typename: 'Query' as const,
    target: {
      __typename: 'Target' as const,
      id: TARGET_ID,
      schemaCheck: {
        __typename: 'SuccessfulSchemaCheck' as const,
        id: variables.schemaCheckId,
        schemaSDL: PRODUCTS_SDL,
        baseline: null,
        compositeSchemaSDL: PRODUCTS_SDL,
        supergraphSDL: PRODUCTS_SDL,
      },
    },
  };
}

function breakingChange(change: {
  path: string[];
  message: string;
  severityReason: string | null;
  isSafeBasedOnUsage: boolean;
  usageTracking: string;
  kind: string;
}) {
  return {
    __typename: 'SchemaChangeEdge' as const,
    node: {
      __typename: 'SchemaChange' as const,
      ...change,
      severityLevel: 'BREAKING',
      approval: null,
      usageStatistics: null,
      affectedAppDeployments: null,
    },
  };
}

/** A check whose breaking changes found no usage, some because usage is never recorded for them. */
export function untrackedUsageSchemaCheck(variables: { schemaCheckId: string }) {
  const active = activeSchemaCheck(variables);
  return {
    ...active,
    project: {
      ...active.project,
      target: {
        ...active.project.target,
        schemaCheck: {
          ...active.project.target.schemaCheck,
          hasSchemaChanges: true,
          breakingSchemaChanges: {
            __typename: 'SchemaChangeConnection' as const,
            totalCount: 3,
            edges: [
              breakingChange({
                path: ['Currency'],
                message: "Type 'Currency' was removed",
                severityReason: null,
                isSafeBasedOnUsage: true,
                usageTracking: 'ON_REFERENCING_FIELDS',
                kind: 'TYPE_REMOVED',
              }),
              breakingChange({
                path: ['SearchResult'],
                message: "Member 'Movie' was removed from Union type 'SearchResult'",
                severityReason:
                  'Removing a union member from a union can cause existing queries that use this union member in a fragment spread to error.',
                isSafeBasedOnUsage: true,
                usageTracking: 'NOT_TRACKED',
                kind: 'UNION_MEMBER_REMOVED',
              }),
              // Tracked, but with no reason and no usage to show.
              breakingChange({
                path: ['ConversionRate', 'fromCurrency'],
                message:
                  "Field 'ConversionRate.fromCurrency' changed type from 'Currency!' to 'ForexCurrency!'",
                severityReason: null,
                isSafeBasedOnUsage: true,
                usageTracking: 'TRACKED',
                kind: 'FIELD_TYPE_CHANGED',
              }),
            ],
          },
        },
      },
    },
  };
}

/** A check whose policy ran and found nothing: an empty warnings list, not null. */
export function noPolicyWarningsSchemaCheck(variables: { schemaCheckId: string }) {
  const active = activeSchemaCheck(variables);
  return {
    ...active,
    project: {
      ...active.project,
      target: {
        ...active.project.target,
        schemaCheck: {
          ...active.project.target.schemaCheck,
          schemaPolicyWarnings: { __typename: 'SchemaPolicyWarningConnection' as const, edges: [] },
        },
      },
    },
  };
}
