// @vitest-environment jsdom
import type { Cache } from '@urql/exchange-graphcache';

// The updaters import pages; these stand in for what cannot load under jsdom.
vi.mock('@/env/frontend', () => import('@/lib/testing/mocks/env'));
vi.mock('@graphql-hive/laboratory', () => import('@/lib/testing/mocks/laboratory'));
vi.mock(
  '@/lib/laboratory-history-storage',
  () => import('@/lib/testing/mocks/laboratory-history-storage'),
);

describe('joinOrganization updater', () => {
  it(
    "invalidates the viewer's organizations so the selector picks up the new one",
    { timeout: 30_000 },
    async () => {
      const { Mutation } = await import('./urql-cache');
      const cache = { invalidate: vi.fn(), updateQuery: vi.fn() };

      Mutation.joinOrganization(
        {
          __typename: 'Mutation',
          joinOrganization: {
            __typename: 'OrganizationPayload',
            selector: { __typename: 'OrganizationSelector', organizationSlug: 'acme' },
            organization: { __typename: 'Organization', id: 'organization-2', slug: 'acme' },
          },
        },
        { code: 'invite-1' },
        cache as unknown as Cache,
        {} as never,
      );

      expect(cache.invalidate).toHaveBeenCalledWith('Query', 'organizations');
    },
  );

  it('does nothing when the invitation was rejected', { timeout: 30_000 }, async () => {
    const { Mutation } = await import('./urql-cache');
    const cache = { invalidate: vi.fn(), updateQuery: vi.fn() };

    Mutation.joinOrganization(
      {
        __typename: 'Mutation',
        joinOrganization: { __typename: 'OrganizationInvitationError', message: 'expired' },
      },
      { code: 'invite-1' },
      cache as unknown as Cache,
      {} as never,
    );

    expect(cache.invalidate).not.toHaveBeenCalled();
  });
});

describe('deleteOrganizationMember updater', () => {
  it(
    "invalidates the viewer's organizations in case the member was the viewer",
    { timeout: 30_000 },
    async () => {
      const { Mutation } = await import('./urql-cache');
      const cache = { invalidate: vi.fn(), updateQuery: vi.fn() };

      Mutation.deleteOrganizationMember(
        {
          __typename: 'Mutation',
          deleteOrganizationMember: {
            __typename: 'OrganizationPayload',
            organization: { __typename: 'Organization', id: 'organization-1' },
          },
        },
        { input: { organizationSlug: 'acme', userId: 'user-1' } },
        cache as unknown as Cache,
        {} as never,
      );

      expect(cache.invalidate).toHaveBeenCalledWith('Query', 'organizations');
    },
  );
});

describe('createTarget updater', () => {
  it(
    "invalidates the project's targets so the selector tree refetches",
    { timeout: 30_000 },
    async () => {
      const { Mutation } = await import('./urql-cache');
      const cache = { invalidate: vi.fn(), updateQuery: vi.fn() };
      const result: Parameters<typeof Mutation.createTarget>[0] = {
        __typename: 'Mutation',
        createTarget: {
          __typename: 'CreateTargetResult',
          ok: {
            __typename: 'CreateTargetResultOk',
            selector: {
              __typename: 'TargetSelector',
              organizationSlug: 'acme',
              projectSlug: 'shop',
              targetSlug: 'staging',
            },
            createdTarget: {
              __typename: 'Target',
              id: 'target-2',
              slug: 'staging',
              project: { __typename: 'Project', id: 'project-1' },
            },
          },
          error: null,
        },
      };
      const args = {
        input: {
          project: { bySelector: { organizationSlug: 'acme', projectSlug: 'shop' } },
          slug: 'staging',
        },
      };

      Mutation.createTarget(result, args, cache as unknown as Cache, {} as never);

      expect(cache.invalidate).toHaveBeenCalledWith(
        { __typename: 'Project', id: 'project-1' },
        'targets',
      );
    },
  );
});

describe('cdn access token updaters', () => {
  const selector = { organizationSlug: 'acme', projectSlug: 'shop', targetSlug: 'staging' };
  const args = { input: { target: { bySelector: selector }, alias: 'ci' } };

  function cacheWithPages() {
    return {
      resolve: vi.fn(() => 'Target:target-1'),
      inspectFields: vi.fn(() => [
        { fieldKey: 'id', fieldName: 'id', arguments: null },
        { fieldKey: 'p1', fieldName: 'cdnAccessTokens', arguments: { first: 10, after: null } },
        { fieldKey: 'p2', fieldName: 'cdnAccessTokens', arguments: { first: 10, after: 'c1' } },
      ]),
      invalidate: vi.fn(),
    };
  }

  it(
    "drops every cached page of the target's tokens after a create",
    { timeout: 30_000 },
    async () => {
      const { Mutation } = await import('./urql-cache');
      const cache = cacheWithPages();
      const result: Parameters<typeof Mutation.createCdnAccessToken>[0] = {
        __typename: 'Mutation',
        createCdnAccessToken: {
          __typename: 'CdnAccessTokenCreateResult',
          error: null,
          ok: {
            __typename: 'CdnAccessTokenCreateResultOk',
            secretAccessToken: 'secret',
            createdCdnAccessToken: { __typename: 'CdnAccessToken', id: 'token-1' },
          },
        },
      };

      Mutation.createCdnAccessToken(result, args, cache as unknown as Cache, {} as never);

      expect(cache.resolve).toHaveBeenCalledWith('Query', 'target', {
        reference: { bySelector: selector },
      });
      expect(cache.invalidate.mock.calls).toEqual([
        ['Target:target-1', 'cdnAccessTokens', { first: 10, after: null }],
        ['Target:target-1', 'cdnAccessTokens', { first: 10, after: 'c1' }],
      ]);
    },
  );

  it('does the same after a delete', { timeout: 30_000 }, async () => {
    const { Mutation } = await import('./urql-cache');
    const cache = cacheWithPages();

    Mutation.deleteCdnAccessToken(
      {
        __typename: 'Mutation',
        deleteCdnAccessToken: {
          __typename: 'DeleteCdnAccessTokenResult',
          error: null,
          ok: { __typename: 'DeleteCdnAccessTokenResultOk', deletedCdnAccessTokenId: 'token-1' },
        },
      },
      { input: { target: { bySelector: selector }, cdnAccessTokenId: 'token-1' } },
      cache as unknown as Cache,
      {} as never,
    );

    expect(cache.invalidate).toHaveBeenCalledTimes(2);
  });

  it(
    'does nothing when the mutation failed or the target is not cached',
    { timeout: 30_000 },
    async () => {
      const { Mutation } = await import('./urql-cache');
      const failed = cacheWithPages();
      Mutation.createCdnAccessToken(
        {
          __typename: 'Mutation',
          createCdnAccessToken: {
            __typename: 'CdnAccessTokenCreateResult',
            error: { __typename: 'CdnAccessTokenCreateResultError', message: 'nope' },
            ok: null,
          },
        },
        args,
        failed as unknown as Cache,
        {} as never,
      );
      expect(failed.invalidate).not.toHaveBeenCalled();

      const unknown = { ...cacheWithPages(), resolve: vi.fn(() => null) };
      Mutation.deleteCdnAccessToken(
        {
          __typename: 'Mutation',
          deleteCdnAccessToken: {
            __typename: 'DeleteCdnAccessTokenResult',
            error: null,
            ok: { __typename: 'DeleteCdnAccessTokenResultOk', deletedCdnAccessTokenId: 'token-1' },
          },
        },
        { input: { target: { bySelector: selector }, cdnAccessTokenId: 'token-1' } },
        unknown as unknown as Cache,
        {} as never,
      );
      expect(unknown.invalidate).not.toHaveBeenCalled();
    },
  );
});

describe('cdn access token updaters through the cache', () => {
  it('refetch the page a list has open after a create', { timeout: 30_000 }, async () => {
    const { pipe, subscribe } = await import('wonka');
    const { createTestClient } = await import('@/lib/testing/urql');
    const { CDNAccessTokensQuery, CDNAccessTokenCreateMutation } = await import(
      '@/components/target/settings/cdn-access-tokens'
    );
    const selector = { organizationSlug: 'acme', projectSlug: 'shop', targetSlug: 'staging' };
    const token = (id: string) => ({
      __typename: 'CdnAccessToken' as const,
      id,
      firstCharacters: 'ab',
      lastCharacters: 'yz',
      alias: id,
      createdAt: '2026-09-27T10:00:00.000Z',
    });
    const client = createTestClient(
      new Map<string, unknown>([
        [
          'CDNAccessTokensQuery',
          {
            __typename: 'Query',
            target: {
              __typename: 'Target',
              id: 'target-1',
              cdnAccessTokens: {
                __typename: 'TargetCdnAccessTokenConnection',
                edges: [{ __typename: 'TargetCdnAccessTokenEdge', node: token('token-1') }],
                pageInfo: {
                  __typename: 'PageInfo',
                  hasNextPage: false,
                  hasPreviousPage: false,
                  endCursor: null,
                },
              },
            },
          },
        ],
        [
          'CDNAccessTokens_CDNAccessTokenCreateMutation',
          {
            __typename: 'Mutation',
            createCdnAccessToken: {
              __typename: 'CdnAccessTokenCreateResult',
              error: null,
              ok: {
                __typename: 'CdnAccessTokenCreateResultOk',
                secretAccessToken: 'secret',
                createdCdnAccessToken: token('token-2'),
              },
            },
          },
        ],
      ]),
    );
    const requests = () => client.seen.filter(name => name === 'CDNAccessTokensQuery').length;

    const page = pipe(
      client.query(CDNAccessTokensQuery, { selector, first: 10, after: null }),
      subscribe(() => {}),
    );
    expect(requests()).toBe(1);

    await client
      .mutation(CDNAccessTokenCreateMutation, {
        input: { target: { bySelector: selector }, alias: 'token-2' },
      })
      .toPromise();

    expect(requests()).toBe(2);
    page.unsubscribe();
  });
});

describe('updateMetricAlertRule through the cache', () => {
  it('merges the edited rule into the detail page in place', { timeout: 30_000 }, async () => {
    const { pipe, subscribe } = await import('wonka');
    const { createTestClient } = await import('@/lib/testing/urql');
    const { AlertForm_UpdateMetricAlertRuleMutation } = await import(
      '@/components/target/alerts/alert-form'
    );
    const { TargetAlertsDetailPage_RuleConfigQuery } = await import('@/pages/target-alerts-detail');
    const slugs = { organizationSlug: 'acme', projectSlug: 'shop', targetSlug: 'staging' };
    const rule = (name: string) => ({
      __typename: 'MetricAlertRule' as const,
      id: 'rule-1',
      name,
      type: 'TRAFFIC',
      metric: null,
      severity: 'WARNING',
      state: 'NORMAL',
      enabled: true,
      timeWindowMinutes: 15,
      thresholdType: 'FIXED_VALUE',
      thresholdValue: 100,
      direction: 'ABOVE',
      confirmationMinutes: 0,
      channels: [],
      savedFilter: null,
      createdAt: '2026-09-27T10:00:00.000Z',
      updatedAt: '2026-09-27T10:00:00.000Z',
      createdBy: null,
      updatedBy: null,
    });
    const client = createTestClient(
      new Map<string, unknown>([
        [
          'TargetAlertsDetailPage_RuleConfigQuery',
          {
            __typename: 'Query',
            target: { __typename: 'Target', id: 'target-1', metricAlertRule: rule('Old name') },
          },
        ],
        [
          'AlertForm_UpdateMetricAlertRule',
          {
            __typename: 'Mutation',
            updateMetricAlertRule: {
              __typename: 'UpdateMetricAlertRuleResult',
              error: null,
              ok: {
                __typename: 'UpdateMetricAlertRuleOk',
                updatedMetricAlertRule: rule('New name'),
              },
            },
          },
        ],
      ]),
    );
    const requests = () =>
      client.seen.filter(name => name === 'TargetAlertsDetailPage_RuleConfigQuery').length;

    let latest: { target?: { metricAlertRule?: { name: string } | null } | null } | undefined;
    const page = pipe(
      client.query(TargetAlertsDetailPage_RuleConfigQuery, { ...slugs, ruleId: 'rule-1' }),
      subscribe(result => {
        latest = result.data;
      }),
    );
    expect(requests()).toBe(1);
    expect(latest?.target?.metricAlertRule?.name).toBe('Old name');

    const result = await client
      .mutation(AlertForm_UpdateMetricAlertRuleMutation, {
        input: {
          project: {
            bySelector: {
              organizationSlug: slugs.organizationSlug,
              projectSlug: slugs.projectSlug,
            },
          },
          ruleId: 'rule-1',
          name: 'New name',
        },
      })
      .toPromise();

    // The mutation returns the full rule; the cache must hand it back, not evict it.
    expect(result.data?.updateMetricAlertRule.ok?.updatedMetricAlertRule.id).toBe('rule-1');
    expect(latest?.target?.metricAlertRule?.name).toBe('New name');
    expect(requests()).toBe(1);
    page.unsubscribe();
  });
});

// The lab seeds its collections from this query on every mount, so the list it selects
// (operations(first: 100)) has to be the field the mutations write.
describe('laboratory operation mutations through the cache', () => {
  const selector = { organizationSlug: 'acme', projectSlug: 'shop', targetSlug: 'staging' };
  const operation = (id: string) => ({
    __typename: 'DocumentCollectionOperation' as const,
    id,
    name: id,
    query: '{ a }',
    variables: '{}',
    headers: '{}',
  });
  const target = (ids: string[]) => ({
    __typename: 'Target' as const,
    id: 'target-1',
    documentCollections: {
      __typename: 'DocumentCollectionConnection' as const,
      edges: [
        {
          __typename: 'DocumentCollectionEdge' as const,
          cursor: 'c1',
          node: {
            __typename: 'DocumentCollection' as const,
            id: 'c1',
            name: 'C',
            description: '',
            operations: {
              __typename: 'DocumentCollectionOperationsConnection' as const,
              edges: ids.map(id => ({
                __typename: 'DocumentCollectionOperationEdge' as const,
                cursor: id,
                node: operation(id),
              })),
            },
          },
        },
      ],
    },
  });
  const laboratory = (ids: string[]) => ({
    __typename: 'Query',
    target: {
      ...target(ids),
      preflightScript: null,
      viewerCanModifyPreflightScript: true,
      viewerCanModifyLaboratory: true,
    },
  });
  const listed = (result: { data?: unknown }) =>
    (
      result.data as {
        target: {
          documentCollections: {
            edges: { node: { operations: { edges: { node: { id: string } }[] } } }[];
          };
        };
      }
    ).target.documentCollections.edges[0].node.operations.edges.map(edge => edge.node.id);

  it('drops a deleted operation from the list the page reads', { timeout: 30_000 }, async () => {
    const { pipe, subscribe } = await import('wonka');
    const { createTestClient } = await import('@/lib/testing/urql');
    const { LaboratoryQuery, DeleteOperationMutation } = await import(
      '@/pages/target-laboratory-new'
    );
    const client = createTestClient(
      new Map<string, unknown>([
        ['Laboratory', laboratory(['op-1', 'op-2'])],
        [
          'LaboratoryDeleteOperation',
          {
            __typename: 'Mutation',
            deleteOperationInDocumentCollection: {
              __typename: 'DeleteDocumentCollectionOperationResult',
              error: null,
              ok: {
                __typename: 'DeleteDocumentCollectionOperationOkPayload',
                deletedId: 'op-1',
                updatedTarget: target(['op-2']),
              },
            },
          },
        ],
      ]),
    );

    const page = pipe(
      client.query(LaboratoryQuery, { selector }),
      subscribe(() => {}),
    );
    await client.mutation(DeleteOperationMutation, { selector, id: 'op-1' }).toPromise();
    const reread = await client.query(LaboratoryQuery, { selector }).toPromise();

    expect(listed(reread)).toEqual(['op-2']);
    expect(client.seen.filter(name => name === 'Laboratory')).toHaveLength(1);
    page.unsubscribe();
  });

  it('adds a created collection without refetching the page', { timeout: 30_000 }, async () => {
    const { pipe, subscribe } = await import('wonka');
    const { createTestClient } = await import('@/lib/testing/urql');
    const { LaboratoryQuery, CreateCollectionMutation } = await import(
      '@/pages/target-laboratory-new'
    );
    const created = {
      __typename: 'DocumentCollection' as const,
      id: 'c2',
      name: 'D',
      description: '',
      operations: { __typename: 'DocumentCollectionOperationsConnection' as const, edges: [] },
    };
    const client = createTestClient(
      new Map<string, unknown>([
        ['Laboratory', laboratory(['op-1'])],
        [
          'LaboratoryCreateCollection',
          {
            __typename: 'Mutation',
            createDocumentCollection: {
              __typename: 'ModifyDocumentCollectionResult',
              error: null,
              ok: {
                __typename: 'ModifyDocumentCollectionOkPayload',
                updatedTarget: {
                  __typename: 'Target',
                  id: 'target-1',
                  documentCollections: {
                    __typename: 'DocumentCollectionConnection',
                    edges: [
                      {
                        __typename: 'DocumentCollectionEdge',
                        cursor: 'c1',
                        node: { __typename: 'DocumentCollection', id: 'c1', name: 'C' },
                      },
                      { __typename: 'DocumentCollectionEdge', cursor: 'c2', node: created },
                    ],
                  },
                },
                collection: created,
              },
            },
          },
        ],
      ]),
    );

    const page = pipe(
      client.query(LaboratoryQuery, { selector }),
      subscribe(() => {}),
    );
    await client
      .mutation(CreateCollectionMutation, { selector, input: { name: 'D', description: '' } })
      .toPromise();
    const reread = await client.query(LaboratoryQuery, { selector }).toPromise();

    const collections = (
      reread.data as { target: { documentCollections: { edges: { node: { id: string } }[] } } }
    ).target.documentCollections.edges.map(edge => edge.node.id);
    expect(collections).toEqual(['c1', 'c2']);
    expect(client.seen.filter(name => name === 'Laboratory')).toHaveLength(1);
    page.unsubscribe();
  });

  it('adds a created operation to the list the page reads', { timeout: 30_000 }, async () => {
    const { pipe, subscribe } = await import('wonka');
    const { createTestClient } = await import('@/lib/testing/urql');
    const { LaboratoryQuery, CreateOperationMutation } = await import(
      '@/pages/target-laboratory-new'
    );
    const client = createTestClient(
      new Map<string, unknown>([
        ['Laboratory', laboratory(['op-1'])],
        [
          'LaboratoryCreateOperation',
          {
            __typename: 'Mutation',
            createOperationInDocumentCollection: {
              __typename: 'ModifyDocumentCollectionOperationResult',
              error: null,
              ok: {
                __typename: 'ModifyDocumentCollectionOperationOkPayload',
                operation: operation('op-2'),
                updatedTarget: target(['op-1', 'op-2']),
              },
            },
          },
        ],
      ]),
    );

    const page = pipe(
      client.query(LaboratoryQuery, { selector }),
      subscribe(() => {}),
    );
    await client
      .mutation(CreateOperationMutation, {
        selector,
        input: { collectionId: 'c1', name: 'op-2', query: '{ a }', variables: '{}', headers: '{}' },
      })
      .toPromise();
    const reread = await client.query(LaboratoryQuery, { selector }).toPromise();

    expect(listed(reread)).toEqual(['op-1', 'op-2']);
    expect(client.seen.filter(name => name === 'Laboratory')).toHaveLength(1);
    page.unsubscribe();
  });
});
