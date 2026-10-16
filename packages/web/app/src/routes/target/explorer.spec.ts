// @vitest-environment jsdom
import { presetLast7Days } from '@/components/ui/date-range-picker';
import { loaderPeriod } from '@/lib/hooks/use-date-range-controller';
import { explorerFixtures, explorerTypeMissing } from '@/lib/testing/fixtures/explorer';
import { layoutFixtures, SLUGS, targetLayout } from '@/lib/testing/fixtures/layouts';
import { renderAtUrl } from '@/lib/testing/router';
import { createTestClient } from '@/lib/testing/urql';
import { createAppRouter } from '@/router';
import { UTCDate } from '@date-fns/utc';
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
vi.mock('supertokens-auth-react', () => import('@/lib/testing/mocks/supertokens'));
vi.mock('supertokens-auth-react/recipe/session', () => import('@/lib/testing/mocks/session'));
// Stripe is off unless a case turns it on; the picker's retention note needs it.
const stripe = vi.hoisted(() => ({ enabled: false }));
vi.mock('@/lib/billing/stripe-public-key', () => ({
  getStripePublicKey: () => (stripe.enabled ? 'pk_test' : null),
  getIsStripeEnabled: () => stripe.enabled,
}));

const EXPLORER = `/${SLUGS.organizationSlug}/${SLUGS.projectSlug}/${SLUGS.targetSlug}/explorer`;
const LAST_WEEK = { from: 'now-7d', to: 'now' };
const LAST_MONTH = { from: 'now-30d', to: 'now' };

function client() {
  return createTestClient(new Map([...layoutFixtures(), ...explorerFixtures()]));
}

async function loadedAt(url: string, testClient = client()) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    urqlClient: testClient,
  });
  await router.load();
  return Object.assign(router, { client: testClient });
}

type TestClient = ReturnType<typeof client>;

function variablesOf(client: TestClient, name: string) {
  return client.requests(name).map(o => o.variables);
}

// A cache-and-network request whose organization the layout document already cached is a partial
// hit, which graphcache forwards as network-only; either way it went to the network to revalidate.
function expectRevalidating(client: TestClient, name: string) {
  for (const operation of client.requests(name)) {
    expect(['cache-and-network', 'network-only']).toContain(operation.context.requestPolicy);
  }
}

function expectReadOnce(client: TestClient, name: string) {
  for (const operation of client.requests(name)) {
    expect(operation.context.requestPolicy).toBe('cache-first');
  }
}

describe('explorer loaders', () => {
  const NOW = '2026-09-28T10:59:50.000Z';
  const RANGE = `from=${LAST_WEEK.from}&to=${LAST_WEEK.to}`;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function expected() {
    const { period } = loaderPeriod(LAST_WEEK, presetLast7Days, new UTCDate(NOW));
    return { ...SLUGS, period };
  }

  it(
    'All starts the page and the type list with the same period',
    { timeout: 30_000 },
    async () => {
      const { client } = await loadedAt(`${EXPLORER}?${RANGE}`);

      expect(variablesOf(client, 'TargetExplorerPageQuery')).toEqual([expected()]);
      expectRevalidating(client, 'TargetExplorerPageQuery');
      expect(variablesOf(client, 'TypeFilter_AllTypes')).toEqual([expected()]);
      expectReadOnce(client, 'TypeFilter_AllTypes');
    },
  );

  it('a type starts its own page document with the type name', { timeout: 30_000 }, async () => {
    const { client } = await loadedAt(`${EXPLORER}/User?${RANGE}`);

    expect(variablesOf(client, 'TargetExplorerTypenamePageQuery')).toEqual([
      { ...expected(), typename: 'User' },
    ]);
    expectRevalidating(client, 'TargetExplorerTypenamePageQuery');
    expect(variablesOf(client, 'TypeFilter_AllTypes')).toHaveLength(1);
  });

  it.each([
    [
      'deprecated',
      'TargetExplorerDeprecatedSchemaPageQuery',
      'DeprecatedSchemaExplorer_DeprecatedSchemaQuery',
    ],
    ['unused', 'TargetExplorerUnusedSchemaPageQuery', 'UnusedSchemaExplorer_UnusedSchemaQuery'],
  ])(
    '%s starts its gate and its schema together',
    { timeout: 30_000 },
    async (view, gate, schema) => {
      const { client } = await loadedAt(`${EXPLORER}/${view}?${RANGE}`);

      expect(variablesOf(client, gate)).toEqual([SLUGS]);
      expectReadOnce(client, gate);
      expect(variablesOf(client, schema)).toEqual([expected()]);
      expectRevalidating(client, schema);
    },
  );

  it(
    'renders the deprecated view from the cache: one request per document',
    { timeout: 30_000 },
    async () => {
      vi.useRealTimers();
      const testClient = client();
      testClient.fixtures.set(
        'DeprecatedSchemaExplorer_DeprecatedSchemaQuery',
        new Promise(() => {}),
      );
      renderAtUrl(`${EXPLORER}/deprecated?${RANGE}`, { client: testClient });
      await screen.findByRole('button', { name: 'Last 7 days' });

      expect(testClient.requests('TargetExplorerDeprecatedSchemaPageQuery')).toHaveLength(1);
      expect(testClient.requests('DeprecatedSchemaExplorer_DeprecatedSchemaQuery')).toHaveLength(1);
    },
  );
});

describe('explorer period', () => {
  it.each(['', '/unused', '/deprecated', '/User'])(
    'sends a bare URL%s to the last week, replacing the entry',
    { timeout: 30_000 },
    async view => {
      const router = await loadedAt(`${EXPLORER}${view}`);

      await waitFor(() => expect(router.state.location.search).toEqual(LAST_WEEK));
      expect(router.state.location.pathname).toBe(`${EXPLORER}${view}`);
      expect(router.history.length).toBe(1);
    },
  );

  it('keeps the filters a bare URL carries through the redirect', { timeout: 30_000 }, async () => {
    const router = await loadedAt(`${EXPLORER}?subgraph=users&meta=owner:team`);

    await waitFor(() =>
      expect(router.state.location.search).toEqual({
        ...LAST_WEEK,
        subgraph: 'users',
        meta: 'owner:team',
      }),
    );
  });

  it('keeps a range in minutes: every preset is on every screen', { timeout: 30_000 }, async () => {
    const router = await loadedAt(`${EXPLORER}/unused?from=now-30m&to=now&subgraph=users`);

    expect(router.state.location.search).toEqual({ from: 'now-30m', to: 'now', subgraph: 'users' });
    expect(router.state.location.state.rangeReset).toBeUndefined();
    const periods = router.client
      .requests('UnusedSchemaExplorer_UnusedSchemaQuery')
      .map(o => (o.variables as { period: { from: string } }).period.from);
    expect(Date.now() - Date.parse(periods[0])).toBeLessThan(60 * 60 * 1000);
  });

  it(
    'resets a range it cannot read to the last week, keeping the filters and noting it',
    { timeout: 30_000 },
    async () => {
      const router = await loadedAt(`${EXPLORER}/unused?from=garbage&to=now&subgraph=users`);

      await waitFor(() =>
        expect(router.state.location.search).toEqual({ ...LAST_WEEK, subgraph: 'users' }),
      );
      expect(router.state.location.pathname).toBe(`${EXPLORER}/unused`);
      expect(router.history.length).toBe(1);
      expect(router.state.location.state.rangeReset).toBe('unreadable');
      // Nothing asked for the range it could not read.
      const periods = router.client
        .requests('UnusedSchemaExplorer_UnusedSchemaQuery')
        .map(o => (o.variables as { period: { from: string } }).period.from);
      expect(periods).toHaveLength(1);
      expect(Date.now() - Date.parse(periods[0])).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    },
  );

  // Every document about the organization must agree on its retention: graphcache normalizes it.
  function hobbyClient(usageRetentionInDays = 7) {
    const fixtures = new Map([...layoutFixtures(), ...explorerFixtures(usageRetentionInDays)]);
    fixtures.set('TargetLayoutQuery', targetLayout({}, { usageRetentionInDays }));
    return createTestClient(fixtures);
  }

  it(
    'a bare URL on a retention shorter than the default lands on the longest fitting preset, quietly',
    { timeout: 30_000 },
    async () => {
      const router = await loadedAt(`${EXPLORER}/unused`, hobbyClient(3));

      await waitFor(() =>
        expect(router.state.location.search).toEqual({ from: 'now-1d', to: 'now' }),
      );
      expect(router.history.length).toBe(1);
      expect(router.state.location.state.rangeReset).toBeUndefined();
    },
  );

  it(
    "resets a range past the organization's retention to the last week, after the warms, and notes it",
    { timeout: 30_000 },
    async () => {
      const router = await loadedAt(
        `${EXPLORER}/unused?from=now-30d&to=now&subgraph=users`,
        hobbyClient(),
      );

      await waitFor(() =>
        expect(router.state.location.search).toEqual({ ...LAST_WEEK, subgraph: 'users' }),
      );
      expect(router.history.length).toBe(1);
      expect(router.state.location.state.rangeReset).toBe('retention');
      // The warms asked for the month once; the request that stands is for the week.
      const periods = router.client
        .requests('UnusedSchemaExplorer_UnusedSchemaQuery')
        .map(o => (o.variables as { period: { from: string } }).period.from);
      expect(Date.now() - Date.parse(periods.at(-1)!)).toBeLessThan(8 * 24 * 60 * 60 * 1000);
    },
  );

  it(
    'the page says what the organization keeps after a retention reset',
    { timeout: 30_000 },
    async () => {
      renderAtUrl(`${EXPLORER}/deprecated?from=now-30d&to=now`, { client: hobbyClient() });

      await screen.findByRole('button', { name: 'Last 7 days' });
      expect(
        await screen.findByText('This organization keeps the last 7 days of usage data.'),
      ).toBeTruthy();
    },
  );

  it('the picker says what the plan keeps and where to upgrade', { timeout: 30_000 }, async () => {
    stripe.enabled = true;
    try {
      renderAtUrl(`${EXPLORER}/deprecated?from=now-7d&to=now`, { client: client() });
      fireEvent.click(await screen.findByRole('button', { name: 'Last 7 days' }));

      await screen.findByText(/Your Hobby plan keeps the last 30 days of usage data\./);
      expect(
        screen.getByRole('link', { name: 'Upgrade for longer retention' }).getAttribute('href'),
      ).toBe(`/${SLUGS.organizationSlug}/view/subscription/manage`);
    } finally {
      stripe.enabled = false;
    }
  });

  it('the page says the range was reset, once', { timeout: 30_000 }, async () => {
    vi.useRealTimers();
    renderAtUrl(`${EXPLORER}/deprecated?from=garbage&to=now`, { client: client() });

    await screen.findByRole('button', { name: 'Last 7 days' });
    expect(await screen.findAllByText('Date range reset to Last 7 days')).toHaveLength(1);
  });

  it(
    'a preset picked on a view lands in the URL beside the filters, and the view re-queries',
    { timeout: 30_000 },
    async () => {
      const testClient = client();
      const { router } = renderAtUrl(`${EXPLORER}/deprecated?from=now-7d&to=now&subgraph=users`, {
        client: testClient,
      });
      const periods = () =>
        testClient
          .requests('DeprecatedSchemaExplorer_DeprecatedSchemaQuery')
          .map(o => (o.variables as { period: { from: string } }).period.from);
      // Unanswered here, so the document is asked again; only the period of the newest ask matters.
      await waitFor(() => expect(periods().length).toBeGreaterThan(0));
      const weekAgo = Date.parse(periods()[0]);
      const asked = periods().length;

      fireEvent.click(await screen.findByRole('button', { name: 'Last 7 days' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Last 30 days' }));

      await waitFor(() =>
        expect(router.state.location.search).toEqual({ ...LAST_MONTH, subgraph: 'users' }),
      );
      // The page re-renders with the new period and asks for it: the button and the data follow the URL.
      await screen.findByRole('button', { name: 'Last 30 days' });
      await waitFor(() => expect(periods().length).toBeGreaterThan(asked));
      expect(Date.parse(periods().at(-1)!)).toBeLessThan(weekAgo);
    },
  );
});

describe('explorer type not found', () => {
  function missingTypeClient(hasVersion: boolean) {
    const fixtures = new Map([...layoutFixtures(), ...explorerFixtures()]);
    fixtures.set('TargetExplorerTypenamePageQuery', explorerTypeMissing({ hasVersion }));
    if (!hasVersion) {
      fixtures.set('TargetLayoutQuery', targetLayout({ latestSchemaVersion: null }));
    }
    return createTestClient(fixtures);
  }

  it(
    'names the type and links back to every type, keeping the range',
    { timeout: 30_000 },
    async () => {
      renderAtUrl(`${EXPLORER}/Missing?from=now-30d&to=now`, { client: missingTypeClient(true) });

      expect(await screen.findByText("Type 'Missing' not found")).toBeTruthy();
      expect(
        screen.getByText("There's no type with this name in the latest version."),
      ).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Browse all types' }).getAttribute('href')).toBe(
        `${EXPLORER}?from=now-30d&to=now`,
      );
    },
  );

  it('asks for a first schema when the target has no version', { timeout: 30_000 }, async () => {
    renderAtUrl(`${EXPLORER}/Missing?from=now-7d&to=now`, { client: missingTypeClient(false) });

    expect(await screen.findByText('Hive is waiting for your first schema')).toBeTruthy();
    expect(screen.queryByText("Type 'Missing' not found")).toBeNull();
  });
});
