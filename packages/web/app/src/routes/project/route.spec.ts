// @vitest-environment jsdom
import { overviewPeriod } from '@/lib/overview-period';
import { layoutFixtures, projectLayout, SLUGS } from '@/lib/testing/fixtures/layouts';
import { createTestClient } from '@/lib/testing/urql';
import { createAppRouter } from '@/router';
import { UTCDate } from '@date-fns/utc';
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
const PROJECT_SLUGS = { organizationSlug: SLUGS.organizationSlug, projectSlug: SLUGS.projectSlug };
const NOW = '2026-09-28T15:30:00.000Z';

type TestClient = ReturnType<typeof createTestClient>;

async function loadedAt(url: string, fixtures = layoutFixtures()) {
  const client = createTestClient(fixtures);
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    urqlClient: client,
  });
  await router.load();
  return { client, router };
}

function requestsOf(client: TestClient, name: string) {
  return client.requests(name).map(o => [o.variables, o.context.requestPolicy]);
}

describe('project overview route', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts the targets with the 14-day window, revalidating', { timeout: 30_000 }, async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    const { client } = await loadedAt(PROJECT);

    const { period, resolution } = overviewPeriod(new UTCDate(NOW));
    const [[variables, policy]] = requestsOf(client, 'ProjectOverviewPageQuery');
    expect(variables).toEqual({ ...PROJECT_SLUGS, chartResolution: resolution, period });
    expect(['cache-and-network', 'network-only']).toContain(policy);
  });

  it('asks for a week on a plan that keeps a week', { timeout: 30_000 }, async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    const fixtures = layoutFixtures();
    fixtures.set('ProjectLayoutQuery', projectLayout({}, { usageRetentionInDays: 7 }));
    const { client } = await loadedAt(PROJECT, fixtures);

    const { period } = overviewPeriod(new UTCDate(NOW), 7);
    const [[variables]] = requestsOf(client, 'ProjectOverviewPageQuery');
    expect(variables).toEqual({ ...PROJECT_SLUGS, chartResolution: 7, period });
  });
});

describe('project alerts route', () => {
  it('starts the page read-once beside the gate', { timeout: 30_000 }, async () => {
    const { client, router } = await loadedAt(`${PROJECT}/view/alerts`);

    expect(router.state.location.pathname).toBe(`${PROJECT}/view/alerts`);
    expect(requestsOf(client, 'ProjectAlertsPageQuery')).toEqual([[PROJECT_SLUGS, 'cache-first']]);
    expect(client.requests('ProjectLayoutQuery')).toHaveLength(1);
  });

  it('sends a viewer who may not modify alerts to the project', { timeout: 30_000 }, async () => {
    const fixtures = layoutFixtures();
    fixtures.set('ProjectLayoutQuery', projectLayout({ viewerCanModifyAlerts: false }));
    const { router } = await loadedAt(`${PROJECT}/view/alerts`, fixtures);

    await waitFor(() => expect(router.state.location.pathname).toBe(PROJECT));
    expect(router.history.length).toBe(1);
  });
});
