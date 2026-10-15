// @vitest-environment jsdom
import {
  activeSchemaCheck,
  approvedPolicySchemaCheck,
  BREAKING_PERIOD,
  breakingSchemaCheck,
  CHECKS,
  checksFixtures,
  policyFailedSchemaCheck,
  SERVICES,
} from '@/lib/testing/fixtures/checks';
import { layoutFixtures, SLUGS } from '@/lib/testing/fixtures/layouts';
import { renderAtUrl } from '@/lib/testing/router';
import { createTestClient } from '@/lib/testing/urql';
import { createAppRouter } from '@/router';
import { createMemoryHistory } from '@tanstack/react-router';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';

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

  it(
    'shows a service from the URL that the latest version does not know',
    { timeout: 30_000 },
    async () => {
      renderAtUrl(`${CHECKS_PAGE}?filter_service=ghost`, { client: client() });
      await screen.findByText(CHECKS.serviceOnly);

      expect(screen.getByRole('combobox', { name: 'Service' }).textContent).toContain('ghost');
    },
  );

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
      expect(change.textContent).toContain('1 operation by 1 client affected');
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
      expect(change.textContent).toContain('Safe based on usage data');
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
