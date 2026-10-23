// @vitest-environment jsdom
import { layoutFixtures, organizationLayout, SLUGS } from '@/lib/testing/fixtures/layouts';
import { organizationMembers } from '@/lib/testing/fixtures/organization-members';
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

const ORGANIZATION = `/${SLUGS.organizationSlug}`;
const MEMBERS = `${ORGANIZATION}/view/members`;
const PAGE = 'OrganizationMembersPageQuery';
const GROUPS = 'Groups_OrganizationGroupQuery';
const FIRST_PAGE = { organizationSlug: SLUGS.organizationSlug, first: 20, after: null };

async function loadedAt(url: string, fixtures = layoutFixtures()) {
  const client = createTestClient(fixtures);
  if (!client.fixtures.has(PAGE)) {
    client.fixtures.set(PAGE, organizationMembers());
  }
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    urqlClient: client,
  });
  await router.load();
  return { client, router };
}

describe('members loaders', () => {
  it('start the page document beside the layout gate, once each', { timeout: 30_000 }, async () => {
    const { client, router } = await loadedAt(MEMBERS);

    expect(router.state.location.pathname).toBe(MEMBERS);
    expect(client.requests(PAGE).map(o => o.variables)).toEqual([FIRST_PAGE]);
    expect(client.requests('OrganizationLayoutQuery')).toHaveLength(1);
  });

  it(
    "carry the list's search and SCIM filter into the variables",
    { timeout: 30_000 },
    async () => {
      const { client } = await loadedAt(
        `${MEMBERS}?search=jo&showPendingSCIMManagementConfirmations=true`,
      );

      expect(client.requests(PAGE).map(o => o.variables)).toContainEqual({
        ...FIRST_PAGE,
        searchTerm: 'jo',
        needsSCIMManagementConfirmation: true,
      });
    },
  );

  it("start groups by slug with the URL's search, revalidating", { timeout: 30_000 }, async () => {
    const { client } = await loadedAt(`${MEMBERS}/groups?search=eng`);

    const [groups] = client.requests(GROUPS);
    expect(groups.variables).toEqual({
      organizationSlug: SLUGS.organizationSlug,
      searchTerm: 'eng',
      after: null,
    });
    expect(['cache-and-network', 'network-only']).toContain(groups.context.requestPolicy);
  });

  it(
    'send a viewer who may not see members to the organization, replacing the entry',
    { timeout: 30_000 },
    async () => {
      // Both documents describe the same organization, so both say no.
      const fixtures = layoutFixtures();
      fixtures.set('OrganizationLayoutQuery', organizationLayout({ viewerCanSeeMembers: false }));
      fixtures.set(PAGE, organizationMembers({ viewerCanSeeMembers: false }));
      const { router } = await loadedAt(MEMBERS, fixtures);

      await waitFor(() => expect(router.state.location.pathname).toBe(ORGANIZATION));
      expect(router.history.length).toBe(1);
    },
  );

  it('send a viewer who may not open a section to the list', { timeout: 30_000 }, async () => {
    const fixtures = layoutFixtures();
    fixtures.set(PAGE, organizationMembers({ viewerCanManageInvitations: false }));
    const { router } = await loadedAt(`${MEMBERS}/invitations`, fixtures);

    await waitFor(() => expect(router.state.location.pathname).toBe(MEMBERS));
    expect(router.history.length).toBe(1);
  });
});
