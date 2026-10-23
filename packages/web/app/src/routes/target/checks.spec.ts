// @vitest-environment jsdom
import {
  activeSchemaCheck,
  BREAKING_PERIOD,
  breakingChangesPage,
  breakingSchemaCheck,
  CHECKS,
  checkSdl,
  checksFixtures,
  MANY_CHANGES,
  manyChangesSchemaCheck,
  noPolicyWarningsSchemaCheck,
  policyFailedSchemaCheck,
  safeChangesPage,
  SERVICES,
  untrackedUsageSchemaCheck,
} from '@/lib/testing/fixtures/checks';
import { layoutFixtures, SLUGS } from '@/lib/testing/fixtures/layouts';
import { renderAtUrl } from '@/lib/testing/router';
import { createTestClient } from '@/lib/testing/urql';
import { createAppRouter } from '@/router';
import { createMemoryHistory } from '@tanstack/react-router';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

const PAGE = vi.hoisted(() => 50);

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
// Real pages hold 300 changes; mounting that many rows makes jsdom slow, and paging works the same.
vi.mock('@/components/target/history/change-page-size', () => ({ CHANGES_PAGE_SIZE: PAGE }));

const CHECKS_PAGE = `/${SLUGS.organizationSlug}/${SLUGS.projectSlug}/${SLUGS.targetSlug}/checks`;

type TestClient = ReturnType<typeof createTestClient>;

function client() {
  return createTestClient(new Map([...layoutFixtures(), ...checksFixtures()]));
}

function listRequests(client: TestClient) {
  return client.requests('SchemaChecks_NavigationQuery').map(operation => operation.variables);
}

// Base UI commits an option only while it is highlighted, so focus and click are separate acts.
async function pickService(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('combobox', { name: 'Service' }));
  });
  const option = await screen.findByRole('option', { name });
  await act(async () => {
    option.focus();
  });
  await act(async () => {
    fireEvent.click(option);
  });
}

describe('schema checks list', () => {
  it('loads the next page into the same list', { timeout: 30_000 }, async () => {
    const testClient = client();
    renderAtUrl(CHECKS_PAGE, { client: testClient });
    await screen.findByText(CHECKS.first[0]);
    expect(screen.getByText(CHECKS.first[1])).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    await screen.findByText(CHECKS.second[0]);
    expect(screen.getByText(CHECKS.first[0])).toBeTruthy();
    expect(screen.getByText(CHECKS.first[1])).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    expect(listRequests(testClient).map(variables => variables?.after)).toEqual([
      null,
      CHECKS.nextCursor,
    ]);
  });

  it('starts over from the first page when a filter changes', { timeout: 30_000 }, async () => {
    const testClient = client();
    renderAtUrl(CHECKS_PAGE, { client: testClient });
    await screen.findByText(CHECKS.first[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByText(CHECKS.second[0]);
    const toggle = screen.getByRole('switch', { name: 'Show only failed checks' });

    fireEvent.click(toggle);

    await waitFor(() => expect(screen.queryByText(CHECKS.first[0])).toBeNull());
    expect(screen.queryByText(CHECKS.second[0])).toBeNull();
    expect(screen.getByText(CHECKS.failedOnly)).toBeTruthy();
    expect(listRequests(testClient).at(-1)).toMatchObject({
      after: null,
      filters: { changed: false, failed: true },
    });
    // The side nav stayed mounted: whether checks exist does not depend on the filters.
    expect(screen.getByRole('switch', { name: 'Show only failed checks' })).toBe(toggle);
    expect(testClient.requests('ChecksPageQuery')).toHaveLength(1);
  });

  it('does not preload a check when its row is hovered', { timeout: 30_000 }, async () => {
    const testClient = client();
    renderAtUrl(CHECKS_PAGE, { client: testClient });
    const row = await screen.findByRole('link', { name: new RegExp(CHECKS.first[0]) });

    fireEvent.mouseEnter(row);
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(testClient.seen).not.toContain('ActiveSchemaCheck_ActiveSchemaCheckQuery');
  });

  it('keeps the selected check when a filter changes', { timeout: 30_000 }, async () => {
    const { router } = renderAtUrl(`${CHECKS_PAGE}/check-2`, { client: client() });
    await screen.findByText(CHECKS.first[1]);

    fireEvent.click(screen.getByRole('switch', { name: 'Show only failed checks' }));

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ filter_failed: true }),
    );
    expect(router.state.location.pathname).toBe(`${CHECKS_PAGE}/check-2`);
    expect(screen.getByText(CHECKS.failedOnly)).toBeTruthy();
    expect(screen.getByText(CHECKS.first[1])).toBeTruthy();
    expect(screen.queryByText('Select a schema check')).toBeNull();
  });
});

describe('service filter', () => {
  it(
    'narrows the list to a service and keeps the selected check',
    { timeout: 30_000 },
    async () => {
      const testClient = client();
      const { router } = renderAtUrl(`${CHECKS_PAGE}/check-2`, { client: testClient });
      await screen.findByText(CHECKS.first[1]);

      await pickService(SERVICES[1]);

      await screen.findByText(CHECKS.serviceOnly);
      expect(router.state.location.search).toMatchObject({ filter_service: SERVICES[1] });
      expect(router.state.location.pathname).toBe(`${CHECKS_PAGE}/check-2`);
      expect(screen.queryByText(CHECKS.first[0])).toBeNull();
      expect(listRequests(testClient).at(-1)).toMatchObject({
        after: null,
        filters: { changed: false, failed: false, serviceName: SERVICES[1] },
      });
      expect(testClient.requests('ChecksPageQuery')).toHaveLength(1);
    },
  );

  it('clears back to all services', { timeout: 30_000 }, async () => {
    const testClient = client();
    const { router } = renderAtUrl(`${CHECKS_PAGE}?filter_service=${SERVICES[1]}`, {
      client: testClient,
    });
    await screen.findByText(CHECKS.serviceOnly);

    await pickService('All services');

    await screen.findByText(CHECKS.first[0]);
    expect(router.state.location.search).not.toHaveProperty('filter_service');
    expect(listRequests(testClient).at(-1)).toMatchObject({
      after: null,
      filters: { changed: false, failed: false, serviceName: null },
    });
  });

  it('shows a service from the URL that no check lists', { timeout: 30_000 }, async () => {
    renderAtUrl(`${CHECKS_PAGE}?filter_service=ghost`, { client: client() });
    await screen.findByText(CHECKS.serviceOnly);

    expect(screen.getByRole('combobox', { name: 'Service' }).textContent).toContain('ghost');
  });

  it("filters to a service from a check row's service name", { timeout: 30_000 }, async () => {
    const testClient = client();
    const { router } = renderAtUrl(CHECKS_PAGE, { client: testClient });
    await screen.findByText(CHECKS.first[0]);

    fireEvent.click(screen.getByRole('button', { name: `Show only checks for ${SERVICES[1]}` }));

    await screen.findByText(CHECKS.serviceOnly);
    expect(router.state.location.search).toMatchObject({ filter_service: SERVICES[1] });
    expect(router.state.location.pathname).toBe(CHECKS_PAGE);
    expect(listRequests(testClient).at(-1)).toMatchObject({
      filters: { serviceName: SERVICES[1] },
    });
    expect(testClient.seen).not.toContain('ActiveSchemaCheck_ActiveSchemaCheckQuery');
  });

  it("filters to a service from the open check's header", { timeout: 30_000 }, async () => {
    const testClient = client();
    testClient.fixtures.set('ActiveSchemaCheck_ActiveSchemaCheckQuery', activeSchemaCheck);
    // An id the list does not show, so the detail's entity does not rewrite a row.
    const { router } = renderAtUrl(`${CHECKS_PAGE}/check-9`, { client: testClient });
    const header = await screen.findByRole('button', {
      name: `Show only checks for ${SERVICES[0]}`,
    });

    fireEvent.click(header);

    await screen.findByText(CHECKS.serviceOnly);
    expect(router.state.location.search).toMatchObject({ filter_service: SERVICES[0] });
    expect(router.state.location.pathname).toBe(`${CHECKS_PAGE}/check-9`);
    expect(screen.getByText(CHECKS.active)).toBeTruthy();
  });

  it('is absent for a single-schema project', { timeout: 30_000 }, async () => {
    const testClient = createTestClient(
      new Map([...layoutFixtures(), ...checksFixtures('SINGLE')]),
    );
    renderAtUrl(CHECKS_PAGE, { client: testClient });
    await screen.findByText(CHECKS.first[0]);

    expect(screen.queryByRole('combobox', { name: 'Service' })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Show only failed checks' })).toBeTruthy();
  });
});

describe('checks route loaders', () => {
  it(
    'start the page and the first list page, with the filters from the URL, before rendering',
    { timeout: 30_000 },
    async () => {
      const testClient = client();
      const router = createAppRouter({
        history: createMemoryHistory({ initialEntries: [`${CHECKS_PAGE}?filter_failed=true`] }),
        urqlClient: testClient,
      });
      await router.load();

      expect(testClient.seen).toContain('ChecksPageQuery');
      expect(listRequests(testClient)).toEqual([
        { ...SLUGS, after: null, filters: { changed: false, failed: true, serviceName: null } },
      ]);
    },
  );

  it('pass the service from the URL to the first list page', { timeout: 30_000 }, async () => {
    const testClient = client();
    const router = createAppRouter({
      history: createMemoryHistory({
        initialEntries: [`${CHECKS_PAGE}?filter_service=${SERVICES[1]}`],
      }),
      urqlClient: testClient,
    });
    await router.load();

    expect(listRequests(testClient)).toEqual([
      {
        ...SLUGS,
        after: null,
        filters: { changed: false, failed: false, serviceName: SERVICES[1] },
      },
    ]);
  });

  it('render the page from the cache: one request per document', { timeout: 30_000 }, async () => {
    const testClient = client();
    renderAtUrl(CHECKS_PAGE, { client: testClient });
    await screen.findByText(CHECKS.first[0]);

    expect(testClient.requests('ChecksPageQuery')).toHaveLength(1);
    expect(listRequests(testClient)).toHaveLength(1);
  });

  it(
    "start the affected deployments' first page on its route, keeping the coordinate",
    { timeout: 30_000 },
    async () => {
      const testClient = client();
      const router = createAppRouter({
        history: createMemoryHistory({
          initialEntries: [`${CHECKS_PAGE}/check-1/affected-deployments?coordinate=Query.me`],
        }),
        urqlClient: testClient,
      });
      await router.load();

      expect(router.state.location.search).toEqual({ coordinate: 'Query.me' });
      const affected = testClient.requests('AffectedDeploymentsQuery');
      expect(affected.map(operation => operation.variables)).toEqual([
        { ...SLUGS, schemaCheckId: 'check-1', first: 20, after: null },
      ]);
    },
  );

  it("start a check's own document on its route, once", { timeout: 30_000 }, async () => {
    const testClient = client();
    testClient.fixtures.set('ActiveSchemaCheck_ActiveSchemaCheckQuery', new Promise(() => {}));
    renderAtUrl(`${CHECKS_PAGE}/check-2`, { client: testClient });
    await screen.findByText(CHECKS.first[1]);

    const active = testClient.requests('ActiveSchemaCheck_ActiveSchemaCheckQuery');
    expect(active.map(operation => operation.variables)).toEqual([
      { ...SLUGS, schemaCheckId: 'check-2' },
    ]);
  });
});

describe('breaking change usage', () => {
  it('opens Insights on the window the check counted usage in', { timeout: 30_000 }, async () => {
    const testClient = client();
    testClient.fixtures.set(
      'ActiveSchemaCheck_ActiveSchemaCheckQuery',
      (variables: Record<string, unknown>) =>
        breakingSchemaCheck(variables as { schemaCheckId: string }, { withTargets: false }),
    );
    const { router } = renderAtUrl(`${CHECKS_PAGE}/check-breaking`, { client: testClient });
    await screen.findByText(CHECKS.first[0]);
    const change = await screen.findByRole(
      'button',
      { name: /was removed from object type/ },
      { timeout: 10_000 },
    );
    await act(async () => {
      fireEvent.click(change);
    });

    const coordinateLink = await screen.findByRole('link', { name: 'staging' });
    const search = (link: HTMLElement) =>
      new URL(link.getAttribute('href')!, 'http://x').searchParams;
    expect(coordinateLink.getAttribute('href')).toContain(
      '/insights/schema-coordinate/Query.products',
    );
    expect(search(coordinateLink).get('from')).toContain(BREAKING_PERIOD.from);
    expect(search(coordinateLink).get('to')).toContain(BREAKING_PERIOD.to);

    // The operation's menu navigates on click rather than through an href.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'View live usage in Insights' }));
    });
    const operationItem = await screen.findByRole('menuitem', { name: 'production' });
    await act(async () => {
      fireEvent.click(operationItem);
    });
    await waitFor(() =>
      expect(router.state.location.pathname).toContain('/insights/abcd_Products/abcd1234'),
    );
    expect(router.state.location.search).toMatchObject({
      from: BREAKING_PERIOD.from,
      to: BREAKING_PERIOD.to,
    });
  });

  it(
    'lists the targets the change was used in, each to verify, and the rest in a menu',
    { timeout: 30_000 },
    async () => {
      const testClient = client();
      testClient.fixtures.set(
        'ActiveSchemaCheck_ActiveSchemaCheckQuery',
        (variables: Record<string, unknown>) =>
          breakingSchemaCheck(variables as { schemaCheckId: string }),
      );
      renderAtUrl(`${CHECKS_PAGE}/check-breaking`, { client: testClient });
      await screen.findByText(CHECKS.first[0]);
      const change = await screen.findByRole(
        'button',
        { name: /was removed from object type/ },
        { timeout: 10_000 },
      );
      expect(change.textContent).toContain('1 client');
      await act(async () => {
        fireEvent.click(change);
      });

      await screen.findByText('Used in 1 of 2 targets during the check window');
      const verify = screen.getByRole('link', { name: /Verify in Insights/ });
      const href = verify.getAttribute('href')!;
      expect(href).toContain('/production/insights/schema-coordinate/Query.products');
      expect(new URL(href, 'http://x').searchParams.get('from')).toContain(BREAKING_PERIOD.from);
      expect(screen.getAllByRole('link', { name: /Verify in Insights/ })).toHaveLength(1);
      expect(screen.getByText('2 requests')).toBeTruthy();
      expect(screen.getByText('from 1 operation')).toBeTruthy();
      expect(screen.getByRole('button', { name: '1 without usage' })).toBeTruthy();
      // The targets carry the links, so the operation row only says where it was seen.
      expect(screen.queryByRole('button', { name: 'View live usage in Insights' })).toBeNull();
      expect(screen.getByText('Seen in')).toBeTruthy();
    },
  );

  it(
    'shows no targets table on a change that is safe based on usage',
    { timeout: 30_000 },
    async () => {
      const testClient = client();
      testClient.fixtures.set(
        'ActiveSchemaCheck_ActiveSchemaCheckQuery',
        (variables: Record<string, unknown>) =>
          breakingSchemaCheck(variables as { schemaCheckId: string }, { safe: true }),
      );
      renderAtUrl(`${CHECKS_PAGE}/check-breaking`, { client: testClient });
      await screen.findByText(CHECKS.first[0]);
      const change = await screen.findByRole(
        'button',
        { name: /was removed from object type/ },
        { timeout: 10_000 },
      );
      expect(change.textContent).toContain('No usage');
      await act(async () => {
        fireEvent.click(change);
      });
      expect(screen.queryByText(/during the check window/)).toBeNull();
      expect(screen.queryByRole('link', { name: /Verify in Insights/ })).toBeNull();
    },
  );

  it('keeps the older layout when no target had usage', { timeout: 30_000 }, async () => {
    const testClient = client();
    testClient.fixtures.set(
      'ActiveSchemaCheck_ActiveSchemaCheckQuery',
      (variables: Record<string, unknown>) =>
        breakingSchemaCheck(variables as { schemaCheckId: string }, { noTargetUsage: true }),
    );
    renderAtUrl(`${CHECKS_PAGE}/check-breaking`, { client: testClient });
    await screen.findByText(CHECKS.first[0]);
    const change = await screen.findByRole(
      'button',
      { name: /was removed from object type/ },
      { timeout: 10_000 },
    );
    await act(async () => {
      fireEvent.click(change);
    });
    expect(screen.queryByText(/during the check window/)).toBeNull();
    await screen.findByText(/target insights for live usage data/);
  });
});

describe('failed check status', () => {
  it(
    'says a check failed on its policy errors, in the header and the graph picker',
    {
      timeout: 30_000,
    },
    async () => {
      const testClient = client();
      testClient.fixtures.set(
        'ActiveSchemaCheck_ActiveSchemaCheckQuery',
        (variables: Record<string, unknown>) =>
          policyFailedSchemaCheck(variables as { schemaCheckId: string }),
      );
      renderAtUrl(`${CHECKS_PAGE}/check-policy`, { client: testClient });

      await screen.findByText('2 schema policy errors', {}, { timeout: 10_000 });
      expect(screen.getByText('Failed')).toBeTruthy();
      expect(screen.getByLabelText('Schema policy errors.')).toBeTruthy();
    },
  );
});

describe('paged changes', () => {
  function pagedClient() {
    const testClient = client();
    testClient.fixtures.set(
      'ActiveSchemaCheck_ActiveSchemaCheckQuery',
      (variables: Record<string, unknown>) =>
        manyChangesSchemaCheck(variables as { schemaCheckId: string }),
    );
    testClient.fixtures.set('CheckBreakingChangesPageQuery', (variables: Record<string, unknown>) =>
      breakingChangesPage(variables as { schemaCheckId: string; offset: number }),
    );
    testClient.fixtures.set('CheckSafeChangesPageQuery', (variables: Record<string, unknown>) =>
      safeChangesPage(variables as { schemaCheckId: string; kind: string; offset: number }),
    );
    return testClient;
  }

  const change = (name: string) => screen.queryByRole('button', { name: new RegExp(`${name}$`) });

  async function next(nav: HTMLElement) {
    await act(async () => {
      fireEvent.click(within(nav).getByRole('button', { name: 'Next page' }));
    });
  }

  it(
    'pages breaking changes and takes the unapproved count from the API',
    { timeout: 30_000 },
    async () => {
      const testClient = pagedClient();
      renderAtUrl(`${CHECKS_PAGE}/check-many`, { client: testClient });

      await screen.findByText(
        `${MANY_CHANGES.breaking} unapproved breaking changes`,
        {},
        { timeout: 10_000 },
      );
      const [breakingNav] = screen.getAllByRole('navigation', { name: 'Pagination' });
      expect(within(breakingNav).getByText('1 / 3')).toBeTruthy();
      expect(change('StressType_0')).toBeTruthy();

      await next(breakingNav);

      await waitFor(() => expect(change(`StressType_${PAGE}`)).toBeTruthy());
      expect(change('StressType_0')).toBeNull();
      expect(testClient.requests('CheckBreakingChangesPageQuery')).toHaveLength(1);
      expect(testClient.requests('CheckBreakingChangesPageQuery')[0].variables).toMatchObject({
        offset: PAGE,
      });

      // A page already seen comes from memory.
      await act(async () => {
        fireEvent.click(within(breakingNav).getByRole('button', { name: 'Previous page' }));
      });
      await waitFor(() => expect(change('StressType_0')).toBeTruthy());
      expect(testClient.requests('CheckBreakingChangesPageQuery')).toHaveLength(1);
    },
  );

  it('collapses an expanded change when the page moves on', { timeout: 30_000 }, async () => {
    renderAtUrl(`${CHECKS_PAGE}/check-many`, { client: pagedClient() });
    const first = await screen.findByRole('button', { name: /StressType_0$/ }, { timeout: 10_000 });
    await act(async () => {
      fireEvent.click(first);
    });
    expect(first.getAttribute('aria-expanded')).toBe('true');

    await next(screen.getAllByRole('navigation', { name: 'Pagination' })[0]);

    // The change now first on the page is another one, so it starts closed.
    const firstOfNextPage = await screen.findByRole('button', {
      name: new RegExp(`StressType_${PAGE}$`),
    });
    expect(firstOfNextPage.getAttribute('aria-expanded')).toBe('false');
  });

  it('groups safe changes by kind and pages a long group', { timeout: 30_000 }, async () => {
    const testClient = pagedClient();
    renderAtUrl(`${CHECKS_PAGE}/check-many`, { client: testClient });

    await screen.findByText('Safe Changes', {}, { timeout: 10_000 });
    const groupTrigger = (label: string) => screen.getByRole('button', { name: new RegExp(label) });
    expect(groupTrigger('Type added').textContent).toContain('2');
    expect(groupTrigger('Type description changed').textContent).toContain(
      String(MANY_CHANGES.descriptions),
    );

    // A group smaller than a page has no pagination; only the breaking list's bar is up.
    await act(async () => {
      fireEvent.click(groupTrigger('Type added'));
    });
    expect(screen.getAllByRole('navigation', { name: 'Pagination' })).toHaveLength(1);

    await act(async () => {
      fireEvent.click(groupTrigger('Type description changed'));
    });
    const groupNav = (await screen.findAllByRole('navigation', { name: 'Pagination' }))[1];
    expect(within(groupNav).getByText('1 / 3')).toBeTruthy();

    await next(groupNav);

    await waitFor(() =>
      expect(testClient.requests('CheckSafeChangesPageQuery')[0]?.variables).toMatchObject({
        kind: 'TYPE_DESCRIPTION_CHANGED',
        offset: PAGE,
      }),
    );
    await waitFor(() => expect(within(groupNav).getByText('2 / 3')).toBeTruthy());
  });

  it('shows the approval on pages visited before approving', { timeout: 30_000 }, async () => {
    const testClient = pagedClient();
    const approval = {
      __typename: 'SchemaChangeApproval' as const,
      approvedBy: { __typename: 'User' as const, id: 'user-1', displayName: 'User' },
      cliApprovalMetadata: null,
      approvedAt: '2026-10-16T00:00:00.000Z',
      schemaCheckId: 'check-many',
    };
    // Approving turns the check successful and every breaking change approved.
    function approved(check: {
      breakingSchemaChanges: { edges: Array<{ node: object }> };
    }): Record<string, unknown> {
      return {
        ...check,
        __typename: 'SuccessfulSchemaCheck' as const,
        breakingSchemaChanges: {
          ...check.breakingSchemaChanges,
          edges: check.breakingSchemaChanges.edges.map(edge => ({
            ...edge,
            node: { ...edge.node, approval },
          })),
        },
      };
    }
    let isApproved = false;
    testClient.fixtures.set(
      'CheckBreakingChangesPageQuery',
      (variables: Record<string, unknown>) => {
        const page = breakingChangesPage(variables as { schemaCheckId: string; offset: number });
        return isApproved
          ? { ...page, target: { ...page.target, schemaCheck: approved(page.target.schemaCheck) } }
          : page;
      },
    );
    testClient.fixtures.set(
      'ApproveFailedSchemaCheckModal_ApproveFailedSchemaCheckMutation',
      (variables: Record<string, unknown>) => {
        isApproved = true;
        const check = manyChangesSchemaCheck({
          schemaCheckId: (variables as { input: { schemaCheckId: string } }).input.schemaCheckId,
        }).project.target.schemaCheck;
        return {
          __typename: 'Mutation' as const,
          approveFailedSchemaCheck: {
            __typename: 'ApproveFailedSchemaCheckResult' as const,
            ok: {
              __typename: 'ApproveFailedSchemaCheckOk' as const,
              schemaCheck: {
                ...approved(check),
                isApproved: true,
                approvedBy: { ...approval.approvedBy, email: 'user@the-guild.dev' },
                approvalComment: null,
              },
            },
            error: null,
          },
        };
      },
    );
    // An approved row's name runs on into its badge, so the type name ends at the last digit.
    const row = (name: string) =>
      screen.queryByRole('button', { name: new RegExp(`${name}(?!\\d)`) });
    renderAtUrl(`${CHECKS_PAGE}/check-many`, { client: testClient });

    await screen.findByText(
      `${MANY_CHANGES.breaking} unapproved breaking changes`,
      {},
      { timeout: 10_000 },
    );
    await next(screen.getAllByRole('navigation', { name: 'Pagination' })[0]);
    await waitFor(() => expect(row(`StressType_${PAGE}`)).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Approve/ }));
    });
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Approve Changes' }));
    });

    // The approved check starts over on its first page, already showing the approval.
    await waitFor(() => expect(row('StressType_0')?.textContent).toContain('Approved'));
    await next(screen.getAllByRole('navigation', { name: 'Pagination' })[0]);

    // The page seen before approving is read again rather than shown from memory.
    await waitFor(() => expect(row(`StressType_${PAGE}`)?.textContent).toContain('Approved'));
    expect(testClient.requests('CheckBreakingChangesPageQuery')).toHaveLength(2);
  });
});

describe('schema tabs', () => {
  // The SDL viewer virtualizes with observers jsdom does not have; nothing here scrolls.
  beforeEach(() => {
    class NoopObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal('IntersectionObserver', NoopObserver);
    vi.stubGlobal('ResizeObserver', NoopObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the SDLs once, when a schema tab first opens', { timeout: 30_000 }, async () => {
    const testClient = client();
    testClient.fixtures.set('ActiveSchemaCheck_ActiveSchemaCheckQuery', activeSchemaCheck);
    testClient.fixtures.set('CheckSdlQuery', (variables: Record<string, unknown>) =>
      checkSdl(variables as { schemaCheckId: string }),
    );
    renderAtUrl(`${CHECKS_PAGE}/check-sdl`, { client: testClient });

    const details = await screen.findByTestId('details-view-btn', {}, { timeout: 10_000 });
    expect(testClient.requests('CheckSdlQuery')).toHaveLength(0);

    await act(async () => {
      fireEvent.click(screen.getByTestId('schema-view-btn'));
    });
    await waitFor(() => expect(screen.queryByText('Loading schema…')).toBeNull());
    expect(screen.queryByText('The schema could not be loaded.')).toBeNull();
    expect(testClient.requests('CheckSdlQuery').map(request => request.variables)).toEqual([
      expect.objectContaining({ schemaCheckId: 'check-sdl' }),
    ]);

    // Back and forth again reads the SDLs from the cache.
    await act(async () => {
      fireEvent.click(details);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('supergraph-view-btn'));
    });
    await waitFor(() => expect(screen.queryByText('Loading schema…')).toBeNull());
    expect(testClient.requests('CheckSdlQuery')).toHaveLength(1);
  });
});

describe('breaking changes without recorded usage', () => {
  function renderCheck() {
    const testClient = client();
    testClient.fixtures.set(
      'ActiveSchemaCheck_ActiveSchemaCheckQuery',
      (variables: Record<string, unknown>) =>
        untrackedUsageSchemaCheck(variables as { schemaCheckId: string }),
    );
    renderAtUrl(`${CHECKS_PAGE}/check-untracked`, { client: testClient });
  }

  it(
    'labels a removed type as untracked and leaves it closed, with nothing to open',
    { timeout: 30_000 },
    async () => {
      renderCheck();
      // The type removal and the union member change; the type removal comes first.
      const labels = await screen.findAllByText('Usage not tracked', {}, { timeout: 10_000 });
      expect(labels).toHaveLength(2);
      expect(labels[0].closest('button')).toBeNull();
      expect(screen.queryByRole('button', { name: /Currency was removed/ })).toBeNull();
      // Only the tracked field change still says safe based on usage.
      expect(screen.getAllByText('No usage')).toHaveLength(1);
      expect(screen.queryByText(/No details available/)).toBeNull();
    },
  );

  it(
    'labels an untracked change that has a reason, and still opens to it',
    { timeout: 30_000 },
    async () => {
      renderCheck();
      const union = await screen.findByRole(
        'button',
        { name: /Movie was removed from Union type SearchResult/ },
        { timeout: 10_000 },
      );
      expect(union.textContent).toContain('Usage not tracked');
      await act(async () => {
        fireEvent.click(union);
      });
      expect(
        screen.getByText(/can cause existing queries that use this union member/),
      ).toBeTruthy();
    },
  );

  it('leaves a tracked change with nothing to show closed too', { timeout: 30_000 }, async () => {
    renderCheck();
    await screen.findByText(/changed type from/, {}, { timeout: 10_000 });
    expect(screen.queryByRole('button', { name: /changed type from/ })).toBeNull();
  });
});

describe('Explorer links', () => {
  const TARGET = `/${SLUGS.organizationSlug}/${SLUGS.projectSlug}/${SLUGS.targetSlug}`;
  // The page nav has its own "Explorer" link; a change's opens in a new tab.
  const changeLinks = () =>
    screen
      .queryAllByRole('link', { name: 'Explorer' })
      .filter(link => link.getAttribute('target') === '_blank');

  it(
    'links each changed coordinate to Explorer in a new tab, outside the row toggle',
    { timeout: 30_000 },
    async () => {
      const testClient = client();
      testClient.fixtures.set(
        'ActiveSchemaCheck_ActiveSchemaCheckQuery',
        (variables: Record<string, unknown>) =>
          untrackedUsageSchemaCheck(variables as { schemaCheckId: string }),
      );
      renderAtUrl(`${CHECKS_PAGE}/check-untracked`, { client: testClient });

      await screen.findByText(/changed type from/, {}, { timeout: 10_000 });
      expect(changeLinks().map(link => link.getAttribute('href'))).toEqual([
        `${TARGET}/explorer/Currency`,
        `${TARGET}/explorer/SearchResult`,
        `${TARGET}/explorer/ConversionRate?search=fromCurrency`,
      ]);
      for (const link of changeLinks()) {
        expect(link.closest('button')).toBeNull();
      }
    },
  );

  it("leaves a check's additions unlinked", { timeout: 30_000 }, async () => {
    const testClient = client();
    testClient.fixtures.set(
      'ActiveSchemaCheck_ActiveSchemaCheckQuery',
      (variables: Record<string, unknown>) =>
        manyChangesSchemaCheck(variables as { schemaCheckId: string }),
    );
    renderAtUrl(`${CHECKS_PAGE}/check-many`, { client: testClient });

    await screen.findByText('Safe Changes', {}, { timeout: 10_000 });
    const breakingLinks = changeLinks().length;
    expect(breakingLinks).toBeGreaterThan(0);
    const badges = screen.queryAllByText('StressType_0').length;

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Type added/ }));
    });
    // The opened group's first row, "Type 'StressType_0' was added", is on screen.
    await waitFor(() =>
      expect(screen.queryAllByText('StressType_0').length).toBeGreaterThan(badges),
    );
    expect(changeLinks()).toHaveLength(breakingLinks);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Type description changed/ }));
    });
    await waitFor(() => expect(changeLinks().length).toBeGreaterThan(breakingLinks));
  });
});

describe('schema policy warnings', () => {
  it(
    'shows no warnings section and no Policy tab when the policy found nothing',
    { timeout: 30_000 },
    async () => {
      const testClient = client();
      testClient.fixtures.set(
        'ActiveSchemaCheck_ActiveSchemaCheckQuery',
        (variables: Record<string, unknown>) =>
          noPolicyWarningsSchemaCheck(variables as { schemaCheckId: string }),
      );
      renderAtUrl(`${CHECKS_PAGE}/check-no-warnings`, { client: testClient });

      const policyTab = await screen.findByTestId('policy-view-btn', {}, { timeout: 10_000 });
      expect(screen.queryByText('Schema Policy Warnings')).toBeNull();
      expect(
        policyTab.hasAttribute('data-disabled') ||
          policyTab.getAttribute('aria-disabled') === 'true',
      ).toBe(true);
    },
  );
});
