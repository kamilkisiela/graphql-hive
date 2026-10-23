// @vitest-environment jsdom
import { PersonalAccessTokensTable_MoreAccessTokensQuery } from '@/components/organization/settings/personal-access-tokens/personal-access-tokens-table';
import { layoutFixtures, organizationLayout, SLUGS } from '@/lib/testing/fixtures/layouts';
import { organizationSettings } from '@/lib/testing/fixtures/organization-settings';
import { createTestClient } from '@/lib/testing/urql';
import { createAppRouter } from '@/router';
import { createMemoryHistory } from '@tanstack/react-router';
import { waitFor } from '@testing-library/react';

// The tree imports every page; these stand in for what cannot load under jsdom.
vi.mock('@/env/frontend', () => import('@/lib/testing/mocks/env'));
vi.mock('@graphql-hive/laboratory', () => import('@/lib/testing/mocks/laboratory'));
vi.mock(
  '@/lib/laboratory-history-storage',
  () => import('@/lib/testing/mocks/laboratory-history-storage'),
);
vi.mock('@/components/schema-editor', async importOriginal => ({
  ...(await importOriginal<typeof import('@/components/schema-editor')>()),
  SchemaEditor: () => null,
}));
vi.mock('@/lib/auth/session', () => import('@/lib/testing/mocks/auth-session'));

const SETTINGS = `/${SLUGS.organizationSlug}/view/settings`;
const SLUG = { organizationSlug: SLUGS.organizationSlug };
const PAGE = 'OrganizationSettingsPageQuery';

type TestClient = ReturnType<typeof createTestClient>;

async function loadedAt(url: string, settings = organizationSettings(), layout?: unknown) {
  const client = createTestClient(layoutFixtures());
  client.fixtures.set(PAGE, settings);
  if (layout) {
    client.fixtures.set('OrganizationLayoutQuery', layout);
  }
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    urqlClient: client,
  });
  await router.load();
  return { client, router };
}

// A revalidating request whose organization the layout already cached is a partial hit, which
// graphcache forwards as network-only.
function expectRevalidating(client: TestClient, name: string) {
  const policies = client.requests(name).map(o => o.context.requestPolicy);
  expect(policies).toHaveLength(1);
  expect(['cache-and-network', 'network-only']).toContain(policies[0]);
}

const SECTIONS = [
  ['sso', 'SingleSignOnSubpageQuery'],
  ['access-tokens', 'AccessTokensSubPage_OrganizationQuery'],
  ['personal-access-tokens', 'PersonalAccessTokensSubPage_OrganizationQuery'],
] as const;

describe('organization settings loaders', () => {
  it.each(SECTIONS)(
    '%s loads the page document once and starts its own, revalidating',
    { timeout: 30_000 },
    async (section, document) => {
      const { client } = await loadedAt(`${SETTINGS}/${section}`);

      expect(client.requests(PAGE).map(o => o.variables)).toEqual([SLUG]);
      expect(client.requests(document).map(o => o.variables)).toEqual([SLUG]);
      expectRevalidating(client, document);
    },
  );

  it('loads General and Policy from the page document alone', { timeout: 30_000 }, async () => {
    const general = await loadedAt(SETTINGS);
    expect(general.client.requests(PAGE)).toHaveLength(1);
    for (const [, document] of SECTIONS) {
      expect(general.client.seen).not.toContain(document);
    }

    const policy = await loadedAt(`${SETTINGS}/policy`);
    expect(policy.client.requests(PAGE)).toHaveLength(1);
  });

  it(
    'sends a viewer who may not open a section to the first one they may, replacing the entry',
    { timeout: 30_000 },
    async () => {
      const { router } = await loadedAt(
        `${SETTINGS}/personal-access-tokens`,
        organizationSettings({ viewerCanManagePersonalAccessTokens: false }),
        organizationLayout({ viewerCanManagePersonalAccessTokens: false }),
      );

      await waitFor(() => expect(router.state.location.pathname).toBe(SETTINGS));
      expect(router.history.length).toBe(1);
    },
  );

  it('sends a viewer who may not open General to Policy', { timeout: 30_000 }, async () => {
    const { router } = await loadedAt(
      SETTINGS,
      organizationSettings({ viewerCanAccessSettings: false }),
      organizationLayout({ viewerCanAccessSettings: false }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe(`${SETTINGS}/policy`));
  });
});

describe('personal access tokens', () => {
  function tokensPage(after: string | null) {
    const nodes = after === null ? ['token-1', 'token-2'] : ['token-3'];
    return {
      __typename: 'Query',
      organization: {
        __typename: 'Organization',
        id: 'organization-1',
        me: {
          __typename: 'Member',
          id: 'member-1',
          accessTokens: {
            __typename: 'PersonalAccessTokenConnection',
            edges: nodes.map(id => ({
              __typename: 'PersonalAccessTokenEdge',
              cursor: `cursor-${id}`,
              node: {
                __typename: 'PersonalAccessToken',
                id,
                title: id,
                firstCharacters: 'hv',
                createdAt: '2026-09-27T10:00:00.000Z',
                expiresAt: null,
              },
            })),
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: after === null,
              endCursor: after === null ? 'cursor-token-2' : null,
            },
          },
        },
      },
    };
  }

  it('merges the pages the table loads into one list', { timeout: 30_000 }, async () => {
    const client = createTestClient(
      new Map([
        [
          'PersonalAccessTokensTable_MoreAccessTokensQuery',
          (variables: { after?: string | null }) => tokensPage(variables.after ?? null),
        ],
      ]),
    );
    const query = (after: string | null, requestPolicy?: 'cache-only') =>
      client
        .query(
          PersonalAccessTokensTable_MoreAccessTokensQuery,
          { ...SLUG, after },
          { requestPolicy },
        )
        .toPromise();

    await query(null);
    await query('cursor-token-2');
    const merged = await query(null, 'cache-only');

    const connection = (
      merged.data as unknown as {
        organization: { me: { accessTokens: { edges: { node: { id: string } }[] } } };
      }
    ).organization.me.accessTokens;
    expect(connection.edges.map(edge => edge.node.id)).toEqual(['token-1', 'token-2', 'token-3']);
    expect(client.requests('PersonalAccessTokensTable_MoreAccessTokensQuery')).toHaveLength(2);
  });
});
