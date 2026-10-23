// @vitest-environment jsdom
import { presetLast7Days } from '@/components/ui/date-range-picker';
import { loaderPeriod } from '@/lib/hooks/use-date-range-controller';
import { layoutFixtures, SLUGS } from '@/lib/testing/fixtures/layouts';
import { tracesFixtures } from '@/lib/testing/fixtures/traces';
import { renderAtUrl } from '@/lib/testing/router';
import { createTestClient } from '@/lib/testing/urql';
import { defaultTracesFilter, defaultTracesSort, tracesPageVariables } from '@/pages/target-traces';
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
vi.mock('@/lib/auth/session', () => import('@/lib/testing/mocks/auth-session'));

const TARGET = `/${SLUGS.organizationSlug}/${SLUGS.projectSlug}/${SLUGS.targetSlug}`;
const TRACES = `${TARGET}/traces`;
const TRACE = `${TRACES}/trace-1`;
const LIST_DOCUMENT = 'TargetTracesPageQuery';
const TRACE_DOCUMENT = 'TargetInsightsNewPageContent_TraceQuery';

async function loadedAt(url: string) {
  const client = createTestClient(layoutFixtures());
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    urqlClient: client,
  });
  await router.load();
  return { client, router };
}

describe('traces route', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    'sends a bare URL to the last week and starts the list, revalidating, with the default filter and sort',
    { timeout: 30_000 },
    async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-09-28T10:59:50.000Z'));
      const { client, router } = await loadedAt(TRACES);
      await waitFor(() => expect(router.state.location.search).toEqual(presetLast7Days.range));

      const { period } = loaderPeriod(
        presetLast7Days.range,
        presetLast7Days,
        new UTCDate('2026-09-28T10:59:50.000Z'),
      );
      expect(
        client.requests(LIST_DOCUMENT).map(o => [o.variables, o.context.requestPolicy]),
      ).toEqual([
        [
          tracesPageVariables(SLUGS, defaultTracesFilter, defaultTracesSort, period),
          'cache-and-network',
        ],
      ]);
    },
  );

  it(
    'resets a range older than the rollups keep, as a retention reset',
    { timeout: 30_000 },
    async () => {
      const { router } = await loadedAt(`${TRACES}?from=now-2y&to=now`);

      await waitFor(() => expect(router.state.location.search).toEqual(presetLast7Days.range));
      expect(router.state.location.state.rangeReset).toBe('retention');
    },
  );

  it('a row link follows the picker', { timeout: 30_000 }, async () => {
    const client = createTestClient(new Map([...layoutFixtures(), ...tracesFixtures()]));
    const { router } = renderAtUrl(`${TRACES}?from=now-1d&to=now`, { client });
    const rowHref = () => screen.getByRole('link', { name: 'trace-1' }).getAttribute('href') ?? '';
    await screen.findByRole('link', { name: 'trace-1' });
    expect(rowHref()).toContain('now-1d');

    fireEvent.click(await screen.findByRole('button', { name: 'Last 24 hours' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Last 7 days' }));

    await waitFor(() => expect(router.state.location.search).toMatchObject({ from: 'now-7d' }));
    await waitFor(() => expect(rowHref()).toContain('now-7d'));
  });

  it('carries the filter and sort from the URL into the list', { timeout: 30_000 }, async () => {
    const filter = { ...defaultTracesFilter, 'graphql.operation': ['GetUser'], duration: [10, 20] };
    const sort = { id: 'duration', desc: false };
    const search = `from=now-1d&to=now&filter=${encodeURIComponent(JSON.stringify(filter))}&sort=${encodeURIComponent(JSON.stringify(sort))}`;
    const { client } = await loadedAt(`${TRACES}?${search}`);

    expect(client.requests(LIST_DOCUMENT)[0]?.variables).toMatchObject({
      filter: { operationNames: ['GetUser'], duration: { min: 10, max: 20 } },
      sort: { sort: 'DURATION', direction: 'ASC' },
      first: 50,
      filterTopN: 5,
    });
  });
});

describe('trace route', () => {
  it(
    'starts the trace document with the page variables before rendering',
    { timeout: 30_000 },
    async () => {
      const client = createTestClient(layoutFixtures());
      const router = createAppRouter({
        history: createMemoryHistory({ initialEntries: [TRACE] }),
        urqlClient: client,
      });
      await router.load();

      expect(client.requests(TRACE_DOCUMENT).map(operation => operation.variables)).toEqual([
        { targetSelector: SLUGS, traceId: 'trace-1' },
      ]);
    },
  );

  it(
    'shows the error when the trace request fails, not "not found"',
    { timeout: 30_000 },
    async () => {
      const client = createTestClient(layoutFixtures());
      client.fixtures.set(TRACE_DOCUMENT, new Error('the server is away'));
      renderAtUrl(TRACE, { client });

      await screen.findByText('Oops, something went wrong.');
      expect(screen.queryByText('Trace not found.')).toBeNull();
    },
  );

  it('carries the range it arrived with back to the list', { timeout: 30_000 }, async () => {
    const client = createTestClient(layoutFixtures());
    client.fixtures.set(TRACE_DOCUMENT, {
      __typename: 'Query',
      target: { __typename: 'Target', id: 'target-1', trace: null },
    });
    renderAtUrl(`${TRACE}?from=now-1d&to=now`, { client });

    // The nav item and the breadcrumb; both carry it.
    const links = await screen.findAllByRole('link', { name: 'Traces' });
    expect(links).toHaveLength(2);
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      expect(new URL(href, 'http://localhost').searchParams.get('from')).toContain('now-1d');
    }
  });

  it('shows "not found" for a trace the server does not have', { timeout: 30_000 }, async () => {
    const client = createTestClient(layoutFixtures());
    client.fixtures.set(TRACE_DOCUMENT, {
      __typename: 'Query',
      target: { __typename: 'Target', id: 'target-1', trace: null },
    });
    renderAtUrl(TRACE, { client });

    await screen.findByText('Trace not found.');
    expect(client.requests(TRACE_DOCUMENT)).toHaveLength(1);
  });
});
