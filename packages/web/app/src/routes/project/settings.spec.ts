// @vitest-environment jsdom
import { layoutFixtures, projectLayout, SLUGS } from '@/lib/testing/fixtures/layouts';
import { projectSettings } from '@/lib/testing/fixtures/project-settings';
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

const PROJECT = `/${SLUGS.organizationSlug}/${SLUGS.projectSlug}`;
const SETTINGS = `${PROJECT}/view/settings`;
const PROJECT_SLUGS = { organizationSlug: SLUGS.organizationSlug, projectSlug: SLUGS.projectSlug };
const PAGE = 'ProjectSettingsPageQuery';

async function loadedAt(url: string, settings = projectSettings(), fixtures = layoutFixtures()) {
  const client = createTestClient(fixtures);
  client.fixtures.set(PAGE, settings);
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    urqlClient: client,
  });
  await router.load();
  return { client, router };
}

describe('project settings loaders', () => {
  it('load the page document once beside one layout request', { timeout: 30_000 }, async () => {
    const { client, router } = await loadedAt(`${SETTINGS}/policy`);

    expect(router.state.location.pathname).toBe(`${SETTINGS}/policy`);
    expect(client.requests(PAGE).map(o => o.variables)).toEqual([PROJECT_SLUGS]);
    expect(client.requests('ProjectLayoutQuery')).toHaveLength(1);
  });

  it('General warms the GitHub integration details', { timeout: 30_000 }, async () => {
    const { client } = await loadedAt(SETTINGS);

    expect(client.requests('getGitHubIntegrationDetails').map(o => o.variables)).toEqual([
      { organizationSlug: SLUGS.organizationSlug },
    ]);
  });

  it('Access Tokens starts its document, revalidating', { timeout: 30_000 }, async () => {
    const { client } = await loadedAt(`${SETTINGS}/access-tokens`);

    const [tokens] = client.requests('ProjectAccessTokensSubPage_OrganizationQuery');
    expect(tokens.variables).toEqual(PROJECT_SLUGS);
    expect(['cache-and-network', 'network-only']).toContain(tokens.context.requestPolicy);
  });

  it(
    'sends Composition on a single-schema project to General, replacing the entry',
    { timeout: 30_000 },
    async () => {
      const fixtures = layoutFixtures();
      fixtures.set('ProjectLayoutQuery', projectLayout({ type: 'SINGLE' }));
      const { router } = await loadedAt(
        `${SETTINGS}/composition`,
        projectSettings({ projectType: 'SINGLE' }),
        fixtures,
      );

      await waitFor(() => expect(router.state.location.pathname).toBe(SETTINGS));
      expect(router.history.length).toBe(1);
    },
  );

  it('sends a viewer who may not open General to Policy', { timeout: 30_000 }, async () => {
    const fixtures = layoutFixtures();
    fixtures.set('ProjectLayoutQuery', projectLayout({ viewerCanModifySettings: false }));
    const { router } = await loadedAt(
      SETTINGS,
      projectSettings({ viewerCanModifySettings: false }),
      fixtures,
    );

    await waitFor(() => expect(router.state.location.pathname).toBe(`${SETTINGS}/policy`));
  });

  it('sends a viewer with neither flag to the project', { timeout: 30_000 }, async () => {
    // Both documents describe the same project, so both say no.
    const denied = { viewerCanModifySettings: false, viewerCanManageProjectAccessTokens: false };
    const fixtures = layoutFixtures();
    fixtures.set('ProjectLayoutQuery', projectLayout(denied));
    const { router } = await loadedAt(`${SETTINGS}/policy`, projectSettings(denied), fixtures);

    await waitFor(() => expect(router.state.location.pathname).toBe(PROJECT));
    expect(router.history.length).toBe(1);
  });
});
