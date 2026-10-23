// @vitest-environment jsdom
import { historyFixtures, VERSIONS } from '@/lib/testing/fixtures/history';
import { layoutFixtures, SLUGS } from '@/lib/testing/fixtures/layouts';
import { renderAtUrl } from '@/lib/testing/router';
import { createTestClient } from '@/lib/testing/urql';
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
vi.mock('@/lib/auth/session', () => import('@/lib/testing/mocks/auth-session'));

const TARGET = `/${SLUGS.organizationSlug}/${SLUGS.projectSlug}/${SLUGS.targetSlug}`;
const VERSION_PAGE = `${TARGET}/history/version-42`;
const LIST = 'HistoryPage_VersionsPageQuery';
const PANE = 'TargetHistoryGraphVersion_ActiveGraphVersionQuery';

type TestClient = ReturnType<typeof createTestClient>;

function client() {
  return createTestClient(new Map([...layoutFixtures(), ...historyFixtures()]));
}

function listRequests(client: TestClient) {
  return client.requests(LIST).map(operation => operation.variables);
}

describe('history list', () => {
  it('loads the next page into the same list', { timeout: 30_000 }, async () => {
    const testClient = client();
    renderAtUrl(VERSION_PAGE, { client: testClient });
    await screen.findByText(VERSIONS.first[0]);
    expect(screen.getByText(VERSIONS.first[1])).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    await screen.findByText(VERSIONS.second[0]);
    expect(screen.getByText(VERSIONS.first[0])).toBeTruthy();
    expect(screen.getByText(VERSIONS.first[1])).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    expect(listRequests(testClient).map(variables => variables?.after)).toEqual([
      null,
      VERSIONS.nextCursor,
    ]);
  });
});

describe('history route loaders', () => {
  it(
    'start the page, the first list page and the version before rendering',
    { timeout: 30_000 },
    async () => {
      const testClient = client();
      const router = createAppRouter({
        history: createMemoryHistory({ initialEntries: [VERSION_PAGE] }),
        urqlClient: testClient,
      });
      await router.load();

      expect(testClient.requests('TargetHistoryPageQuery').map(o => o.variables)).toEqual([SLUGS]);
      expect(listRequests(testClient)).toEqual([{ ...SLUGS, first: 10, after: null }]);
      expect(testClient.requests(PANE).map(o => o.variables)).toEqual([
        { ...SLUGS, schemaVersionId: 'version-42' },
      ]);
    },
  );

  it('render the page from the cache: one request per document', { timeout: 30_000 }, async () => {
    const testClient = client();
    testClient.fixtures.set(PANE, new Promise(() => {}));
    renderAtUrl(VERSION_PAGE, { client: testClient });
    await screen.findByText(VERSIONS.first[0]);

    expect(testClient.requests('TargetHistoryPageQuery')).toHaveLength(1);
    expect(listRequests(testClient)).toHaveLength(1);
    expect(testClient.requests(PANE)).toHaveLength(1);
  });

  it(
    'a revisit revalidates the list and reads the page again from the cache',
    { timeout: 30_000 },
    async () => {
      const testClient = client();
      const { router } = renderAtUrl(VERSION_PAGE, { client: testClient });
      await screen.findByText(VERSIONS.first[0]);

      await router.navigate({
        to: '/$organizationSlug/$projectSlug/$targetSlug/checks',
        params: SLUGS,
        search: {},
      });
      await screen.findByRole('link', { name: 'Checks', current: 'page' });
      await router.navigate({
        to: '/$organizationSlug/$projectSlug/$targetSlug/history/$versionId',
        params: { ...SLUGS, versionId: 'version-42' },
      });
      await screen.findByText(VERSIONS.first[0]);

      await waitFor(() => expect(listRequests(testClient)).toHaveLength(2));
      expect(testClient.requests('TargetHistoryPageQuery')).toHaveLength(1);
    },
  );

  it('shows the error on the version pane, not "not found"', { timeout: 30_000 }, async () => {
    const testClient = client();
    testClient.fixtures.set(PANE, new Error('the server is away'));
    renderAtUrl(VERSION_PAGE, { client: testClient });

    await screen.findByText('Oops, something went wrong.');
    expect(screen.queryByText('Schema Version not found.')).toBeNull();
    // The pane shows the error beside the list; the router's error boundary would replace both.
    expect(screen.getByText(/the server is away/)).toBeTruthy();
    expect(screen.getByText(VERSIONS.first[0])).toBeTruthy();
  });
});
