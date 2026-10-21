// @vitest-environment jsdom
import { APP, appsFixtures, appsPage, appVersionPage, DOCUMENT } from '@/lib/testing/fixtures/apps';
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

const APPS = `/${SLUGS.organizationSlug}/${SLUGS.projectSlug}/${SLUGS.targetSlug}/apps`;
const VERSION = `${APPS}/app/1.0.0`;
const LIST = 'TargetAppsViewQuery';
const DOCUMENTS = 'TargetAppsVersionQuery';
const NO_APPS = 'Hive is waiting for your first app deployment';
const NO_MATCH = 'No documents found matching that operation name';

type TestClient = ReturnType<typeof createTestClient>;
type ListVariables = { sort: { field: string } };
type DocumentsVariables = { documentsFilter: { operationName: string } };

function client() {
  return createTestClient(new Map([...layoutFixtures(), ...appsFixtures()]));
}

function variablesOf(client: TestClient, name: string) {
  return client.requests(name).map(operation => operation.variables);
}

async function loadedAt(url: string) {
  const testClient = client();
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    urqlClient: testClient,
  });
  await router.load();
  return testClient;
}

describe('apps route', () => {
  it('starts the list with the sort from the URL', { timeout: 30_000 }, async () => {
    const sort = { field: 'CREATED_AT', direction: 'ASC' };
    const testClient = await loadedAt(`${APPS}?sort=${encodeURIComponent(JSON.stringify(sort))}`);

    expect(variablesOf(testClient, LIST)).toEqual([{ ...SLUGS, sort }]);
  });

  it('sorts a bare URL by activation, newest first', { timeout: 30_000 }, async () => {
    const testClient = await loadedAt(APPS);

    expect(variablesOf(testClient, LIST)).toEqual([
      { ...SLUGS, sort: { field: 'ACTIVATED_AT', direction: 'DESC' } },
    ]);
  });

  it('renders the list from the cache: one request', { timeout: 30_000 }, async () => {
    const testClient = client();
    renderAtUrl(APPS, { client: testClient });

    await screen.findByText(APP.label);
    expect(variablesOf(testClient, LIST)).toHaveLength(1);
  });

  it(
    'keeps the rows, dimmed, with the sort header spinning while a new sort loads',
    { timeout: 30_000 },
    async () => {
      const testClient = client();
      const { router } = renderAtUrl(APPS, { client: testClient });
      await screen.findByText(APP.label);
      testClient.fixtures.set(LIST, (variables: ListVariables) =>
        variables.sort.field === 'CREATED_AT' ? new Promise(() => {}) : appsPage(),
      );

      await router.navigate({
        to: '/$organizationSlug/$projectSlug/$targetSlug/apps',
        params: SLUGS,
        search: { sort: { field: 'CREATED_AT', direction: 'ASC' } },
      });

      await screen.findByRole('status', { name: 'Sorting' });
      expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true');
      expect(screen.getByText(APP.label)).toBeTruthy();
      expect(screen.queryByText(NO_APPS)).toBeNull();
      expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
    },
  );
});

describe('app version route', () => {
  it(
    'starts the documents with the search and coordinate from the URL',
    { timeout: 30_000 },
    async () => {
      const testClient = await loadedAt(`${VERSION}?search=GetUser&coordinates=Query.me`);

      expect(variablesOf(testClient, DOCUMENTS)).toEqual([
        {
          ...SLUGS,
          appName: 'app',
          appVersion: '1.0.0',
          first: 20,
          documentsFilter: { operationName: 'GetUser', schemaCoordinates: ['Query.me'] },
        },
      ]);
    },
  );

  it('asks for every document of a bare URL', { timeout: 30_000 }, async () => {
    const testClient = await loadedAt(VERSION);

    expect(variablesOf(testClient, DOCUMENTS)[0]).toMatchObject({
      documentsFilter: { operationName: '', schemaCoordinates: null },
    });
  });

  it(
    'renders from the cache, then searches once per pause in typing, through the URL',
    { timeout: 30_000 },
    async () => {
      const testClient = client();
      const { router } = renderAtUrl(VERSION, { client: testClient });
      await screen.findByText(DOCUMENT.hash);
      expect(variablesOf(testClient, DOCUMENTS)).toHaveLength(1);

      const input = screen.getByPlaceholderText('Search by operation name...');
      fireEvent.change(input, { target: { value: 'Ge' } });
      fireEvent.change(input, { target: { value: 'Get' } });
      expect(router.state.location.search).toEqual({});
      expect(variablesOf(testClient, DOCUMENTS)).toHaveLength(1);

      await waitFor(() => expect(router.state.location.search).toEqual({ search: 'Get' }), {
        timeout: 3000,
      });
      await screen.findByText(NO_MATCH);
      expect(variablesOf(testClient, DOCUMENTS)).toHaveLength(2);
      expect(variablesOf(testClient, DOCUMENTS)[1]).toMatchObject({
        documentsFilter: { operationName: 'Get' },
      });
    },
  );

  it(
    'follows a URL change from elsewhere instead of writing its term back',
    { timeout: 30_000 },
    async () => {
      const testClient = client();
      const { router } = renderAtUrl(VERSION, { client: testClient });
      await screen.findByText(DOCUMENT.hash);
      const input = screen.getByPlaceholderText('Search by operation name...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Get' } });
      await waitFor(() => expect(router.state.location.search).toEqual({ search: 'Get' }), {
        timeout: 3000,
      });

      // The "Clear filter" link navigates without a search.
      await router.navigate({
        to: '/$organizationSlug/$projectSlug/$targetSlug/apps/$appName/$appVersion',
        params: { ...SLUGS, appName: 'app', appVersion: '1.0.0' },
        search: {},
      });

      await waitFor(() => expect(input.value).toBe(''));
      await new Promise(resolve => setTimeout(resolve, 700));
      expect(router.state.location.search).toEqual({});
    },
  );

  it('keeps the rows, dimmed, while a search loads', { timeout: 30_000 }, async () => {
    const testClient = client();
    const { router } = renderAtUrl(VERSION, { client: testClient });
    await screen.findByText(DOCUMENT.hash);
    testClient.fixtures.set(DOCUMENTS, (variables: DocumentsVariables) =>
      variables.documentsFilter.operationName === 'zzz'
        ? new Promise(() => {})
        : appVersionPage(variables),
    );

    fireEvent.change(screen.getByPlaceholderText('Search by operation name...'), {
      target: { value: 'zzz' },
    });
    await waitFor(() => expect(router.state.location.search).toEqual({ search: 'zzz' }), {
      timeout: 3000,
    });

    await waitFor(() => expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true'));
    expect(screen.getByText(DOCUMENT.hash)).toBeTruthy();
    expect(screen.queryByText(/No documents/)).toBeNull();
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
  });
});
