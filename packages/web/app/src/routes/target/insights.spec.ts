// @vitest-environment jsdom
import { presetLast7Days } from '@/components/ui/date-range-picker';
import { insightsFixtures, OPERATION } from '@/lib/testing/fixtures/insights';
import { layoutFixtures, SLUGS } from '@/lib/testing/fixtures/layouts';
import { renderAtUrl } from '@/lib/testing/router';
import { createTestClient, operationName } from '@/lib/testing/urql';
import { createAppRouter } from '@/router';
import { createMemoryHistory } from '@tanstack/react-router';
import { fireEvent, screen, waitFor } from '@testing-library/react';

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
// ECharts draws on a canvas, which jsdom does not implement.
vi.mock('@/components/ui/primitives/chart/chart', () => ({ Chart: () => null }));
vi.mock('@/lib/auth/session', () => import('@/lib/testing/mocks/auth-session'));

const TARGET = `/${SLUGS.organizationSlug}/${SLUGS.projectSlug}/${SLUGS.targetSlug}`;

// An absolute range, so the loader and the page resolve the same period whatever the clock does
// between them: the seven days up to the top of this hour.
const HOUR = 60 * 60 * 1000;
const to = new Date(Math.floor(Date.now() / HOUR) * HOUR).toISOString();
const from = new Date(Date.parse(to) - 7 * 24 * HOUR).toISOString();
const RANGE_TO = to;
const RANGE = `from=${from}&to=${to}`;
const OPERATIONS = `operations=${encodeURIComponent(JSON.stringify([OPERATION.hash]))}`;
// Under jsdom the router parses search as JSON (see needsJsurl2 in router.ts); a production
// /insights URL is jsurl2, so bring values here, not a pasted URL.
const INSIGHTS = `${TARGET}/insights?${RANGE}&${OPERATIONS}`;
const OPERATION_PAGE = `${TARGET}/insights/${OPERATION.name}/${OPERATION.hash}?${RANGE}`;

const PAGE_DOCUMENTS = [
  'TargetOperationsPageQuery',
  'InsightsFilterPicker',
  'Stats_GeneralOperationsStats',
  'OperationsList_OperationsStats',
];

type TestClient = ReturnType<typeof createTestClient>;

function fixtures() {
  return new Map([...layoutFixtures(), ...insightsFixtures()]);
}

function requests(client: TestClient, name: string) {
  return client.requests(name).length;
}

function variablesOf(client: TestClient, name: string) {
  return client.requests(name)[0]?.variables;
}

// Seven days resolve at hour resolution: bounds on the hour, a count capped at 90 points.
function expectPeriod(variables: unknown) {
  const { period, resolution } = variables as {
    period: { from: string; to: string };
    resolution?: number;
  };
  expect(Date.parse(period.from)).toBe(Date.parse(from));
  expect(Date.parse(period.to)).toBe(Date.parse(to) + HOUR - 1000);
  if (resolution !== undefined) {
    expect(resolution).toBe(90);
  }
}

describe('insights route', () => {
  it(
    'starts every document the page reads, with its variables, before rendering',
    { timeout: 30_000 },
    async () => {
      const client = createTestClient(layoutFixtures());
      const router = createAppRouter({
        history: createMemoryHistory({ initialEntries: [INSIGHTS] }),
        urqlClient: client,
      });
      await router.load();

      expect(client.seen).toEqual(expect.arrayContaining(PAGE_DOCUMENTS));
      const policies = client.operations.map(operation => [
        operationName(operation),
        operation.context.requestPolicy,
      ]);
      expect(policies).toEqual(
        expect.arrayContaining([
          ['TargetOperationsPageQuery', 'cache-first'],
          ['InsightsFilterPicker', 'cache-first'],
          ['Stats_GeneralOperationsStats', 'cache-and-network'],
          ['OperationsList_OperationsStats', 'cache-and-network'],
        ]),
      );
      const filter = { operationIds: [OPERATION.hash] };
      expect(variablesOf(client, 'TargetOperationsPageQuery')).toEqual(SLUGS);
      expect(variablesOf(client, 'InsightsFilterPicker')).toMatchObject({ selector: SLUGS });
      expectPeriod(variablesOf(client, 'InsightsFilterPicker'));
      expect(variablesOf(client, 'Stats_GeneralOperationsStats')).toMatchObject({
        targetSelector: SLUGS,
        filter,
      });
      expectPeriod(variablesOf(client, 'Stats_GeneralOperationsStats'));
      expect(variablesOf(client, 'OperationsList_OperationsStats')).toMatchObject({
        targetSelector: SLUGS,
        filter,
      });
      expectPeriod(variablesOf(client, 'OperationsList_OperationsStats'));
    },
  );

  it('sends a bare URL to the default range and loads once', { timeout: 30_000 }, async () => {
    const client = createTestClient(layoutFixtures());
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: [`${TARGET}/insights`] }),
      urqlClient: client,
    });
    await router.load();

    await waitFor(() => expect(router.state.location.search).toEqual(presetLast7Days.range));
    for (const name of PAGE_DOCUMENTS) {
      expect(requests(client, name)).toBe(1);
    }
  });

  it('renders the page from the cache: one request per document', { timeout: 30_000 }, async () => {
    const client = createTestClient(fixtures());
    renderAtUrl(INSIGHTS, { client });
    await screen.findByRole('button', { name: 'Refresh' });
    await screen.findByText('Total requests served');

    for (const name of PAGE_DOCUMENTS) {
      expect(requests(client, name)).toBe(1);
    }
  });

  it(
    'Refresh reloads the route: the stats again, nothing else, no remount',
    { timeout: 30_000 },
    async () => {
      const client = createTestClient(fixtures());
      renderAtUrl(INSIGHTS, { client });
      const refresh = await screen.findByRole('button', { name: 'Refresh' });

      fireEvent.click(refresh);

      await waitFor(() => {
        expect(requests(client, 'Stats_GeneralOperationsStats')).toBe(2);
        expect(requests(client, 'OperationsList_OperationsStats')).toBe(2);
      });
      for (const name of [
        'TargetOperationsPageQuery',
        'InsightsFilterPicker',
        'TargetLayoutQuery',
        'ViewerQuery',
      ]) {
        expect(requests(client, name)).toBe(1);
      }
      expect(screen.getByRole('button', { name: 'Refresh' })).toBe(refresh);
    },
  );
});

describe('operation route', () => {
  it('receives the range the list row carries', { timeout: 30_000 }, async () => {
    const client = createTestClient(fixtures());
    renderAtUrl(INSIGHTS, { client });
    const links = await screen.findAllByRole('link', { name: OPERATION.name });

    const hrefs = links.map(link => new URL(link.getAttribute('href') ?? '', 'http://localhost'));
    const row = hrefs.find(
      url => url.pathname === `${TARGET}/insights/${OPERATION.name}/${OPERATION.hash}`,
    );
    expect(row?.searchParams.get('from')).toContain(from);
    expect(row?.searchParams.get('to')).toContain(to);
  });

  it('is not preloaded when an operations row is hovered', { timeout: 30_000 }, async () => {
    const client = createTestClient(fixtures());
    renderAtUrl(INSIGHTS, { client });
    const row = await screen.findByRole('link', { name: OPERATION.name });

    fireEvent.mouseEnter(row);
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(client.seen).not.toContain('OperationInsightsPageQuery');
  });

  it('Refresh reloads its stats alone', { timeout: 30_000 }, async () => {
    const client = createTestClient(fixtures());
    renderAtUrl(OPERATION_PAGE, { client });
    const refresh = await screen.findByRole('button', { name: 'Refresh' });

    fireEvent.click(refresh);

    await waitFor(() => expect(requests(client, 'Stats_GeneralOperationsStats')).toBe(2));
    expect(requests(client, 'OperationInsightsPageQuery')).toBe(1);
    expect(requests(client, 'GraphQLOperationBody_GetOperationBodyQuery')).toBe(1);
  });

  it('warms the body and the stats of this operation alone', { timeout: 30_000 }, async () => {
    const client = createTestClient(fixtures());
    renderAtUrl(OPERATION_PAGE, { client });
    await screen.findByText('Relative Request Frequency');

    expect(variablesOf(client, 'Stats_GeneralOperationsStats')).toMatchObject({
      targetSelector: SLUGS,
      filter: { operationIds: [OPERATION.hash] },
    });
    expectPeriod(variablesOf(client, 'Stats_GeneralOperationsStats'));
    expect(variablesOf(client, 'GraphQLOperationBody_GetOperationBodyQuery')).toEqual({
      selector: SLUGS,
      hash: OPERATION.hash,
    });
    for (const name of [
      'OperationInsightsPageQuery',
      'GraphQLOperationBody_GetOperationBodyQuery',
      'Stats_GeneralOperationsStats',
    ]) {
      expect(requests(client, name)).toBe(1);
    }
  });
});

describe('a range the route cannot read', () => {
  it('resets to the last day on an operation, noting it', { timeout: 30_000 }, async () => {
    const client = createTestClient(layoutFixtures());
    const router = createAppRouter({
      history: createMemoryHistory({
        initialEntries: [
          `${TARGET}/insights/${OPERATION.name}/${OPERATION.hash}?from=garbage&to=now`,
        ],
      }),
      urqlClient: client,
    });
    await router.load();

    await waitFor(() =>
      expect(router.state.location.search).toEqual({ from: 'now-1d', to: 'now' }),
    );
    expect(router.state.location.state.rangeReset).toBe('unreadable');
    expect(router.history.length).toBe(1);
  });
});

describe('client and coordinate routes', () => {
  async function loadedAt(url: string) {
    const client = createTestClient(layoutFixtures());
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: [url] }),
      urqlClient: client,
    });
    await router.load();
    return client;
  }

  it(
    'start the gate and the client stats together, revalidating',
    { timeout: 30_000 },
    async () => {
      const client = await loadedAt(`${TARGET}/insights/client/web?${RANGE}`);

      expect(variablesOf(client, 'ClientInsightsPageQuery')).toEqual(SLUGS);
      const [stats] = client.requests('ClientView_ClientStatsQuery');
      expect(stats.variables).toMatchObject({ targetSelector: SLUGS, clientName: 'web' });
      expectPeriod(stats.variables);
      expect(stats.context.requestPolicy).toBe('cache-and-network');
    },
  );

  it(
    'start the gate and the coordinate stats together, with the type',
    { timeout: 30_000 },
    async () => {
      const client = await loadedAt(`${TARGET}/insights/schema-coordinate/Query.me?${RANGE}`);

      expect(variablesOf(client, 'TargetSchemaCoordinatePageQuery')).toEqual(SLUGS);
      const [stats] = client.requests('SchemaCoordinateView_SchemaCoordinateStatsQuery');
      expect(stats.variables).toMatchObject({
        targetSelector: SLUGS,
        type: 'Query',
        schemaCoordinate: 'Query.me',
      });
      expectPeriod(stats.variables);
      expect(stats.context.requestPolicy).toBe('cache-and-network');
    },
  );

  it('default a bare URL to the last week without a redirect', { timeout: 30_000 }, async () => {
    const client = createTestClient(layoutFixtures());
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: [`${TARGET}/insights/client/web`] }),
      urqlClient: client,
    });
    await router.load();

    expect(router.state.location.search).toEqual({});
    const { period } = variablesOf(client, 'ClientView_ClientStatsQuery') as {
      period: { from: string; to: string };
    };
    expect(Date.parse(period.to) - Date.parse(period.from)).toBeGreaterThan(7 * 24 * HOUR - HOUR);
    expect(Date.parse(period.to) - Date.parse(period.from)).toBeLessThan(7 * 24 * HOUR + HOUR);
  });
});

describe('manage filters route', () => {
  it('starts the saved filters document with the page variables', { timeout: 30_000 }, async () => {
    const client = createTestClient(layoutFixtures());
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: [`${TARGET}/insights/manage-filters`] }),
      urqlClient: client,
    });
    await router.load();

    expect(client.requests('ManageFilters_SavedFiltersQuery')[0]?.variables).toEqual({
      organizationSlug: SLUGS.organizationSlug,
      selector: SLUGS,
    });
  });
});

describe('insights preloading', () => {
  it('a hover only warms; the visit that follows revalidates', { timeout: 30_000 }, async () => {
    const client = createTestClient(fixtures());
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: [TARGET] }),
      urqlClient: client,
    });
    await router.load();
    const to = '/$organizationSlug/$projectSlug/$targetSlug/insights';
    const search = { from, to: RANGE_TO };
    const stats = () =>
      client
        .requests('Stats_GeneralOperationsStats')
        .map(operation => [operation.context.preload, operation.context.requestPolicy]);

    await router.preloadRoute({ to, params: SLUGS, search });
    expect(stats()).toEqual([[true, 'cache-first']]);

    await router.navigate({ to, params: SLUGS, search });
    await waitFor(() => expect(stats()).toHaveLength(2));
    // The network leg of a cache-and-network hit reaches the network as network-only.
    expect(stats()[1]).toEqual([false, 'network-only']);
  });
});

describe('the period', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Only the clock is faked; timers stay real so the router and waitFor run as usual.
  it(
    'is resolved once, by the loader, so a filter change after the hour rolls over stays on one period',
    { timeout: 30_000 },
    async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-09-28T10:59:30.000Z'));
      const client = createTestClient(fixtures());
      const { router } = renderAtUrl(`${TARGET}/insights?from=now-7d&to=now`, { client });
      await screen.findByText('Total requests served');
      const periods = () =>
        client
          .requests('Stats_GeneralOperationsStats')
          .map(operation => (operation.variables as { period: { to: string } }).period.to);
      expect(periods()).toHaveLength(1);

      vi.setSystemTime(new Date('2026-09-28T11:00:30.000Z'));
      await router.navigate({
        to: '/$organizationSlug/$projectSlug/$targetSlug/insights',
        params: SLUGS,
        search: { from: 'now-7d', to: 'now', operations: [OPERATION.hash] },
      });
      await waitFor(() => expect(periods()).toHaveLength(2));
      await new Promise(resolve => setTimeout(resolve, 100));

      // One request per filter, both on the new bucket: the page did not ask for the old one.
      expect(periods()).toHaveLength(2);
      expect(new Date(periods()[1]).getUTCHours()).toBe(11);
    },
  );
});
