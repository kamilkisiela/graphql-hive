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

/** The services that have checks, as `ChecksPageQuery` returns them. */
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
      schemaCheckServiceNames: projectType === 'SINGLE' ? null : [...SERVICES],
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
          schemaSDL: 'type Query { products: [String!]! }',
          baseline: null,
          compositeSchemaSDL: null,
          supergraphSDL: null,
          breakingSchemaChanges: null,
          safeSchemaChanges: null,
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
