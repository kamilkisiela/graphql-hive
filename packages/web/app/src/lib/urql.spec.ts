// @vitest-environment jsdom
import { parse } from 'graphql';

// The client reads the env at import time; each case rebuilds the module with its own prefix.
// Importing it evaluates the introspection schema, which is why the cases carry a long timeout.
const persistedOperationsPrefix = vi.hoisted(() => ({ current: null as string | null }));
vi.mock('@/env/frontend', async () => {
  const { env } = await import('@/lib/testing/mocks/env');
  return {
    get env() {
      return { ...env, graphql: { persistedOperationsPrefix: persistedOperationsPrefix.current } };
    },
  };
});
const signOut = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('@/lib/auth/session', () => ({
  attemptRefreshingSession: async () => true,
  signOut,
}));

const fetchMock = vi.fn(
  async () =>
    new Response(JSON.stringify({ data: { isCDNEnabled: true } }), {
      headers: { 'content-type': 'application/json' },
    }),
);

// The persisted-operations exchange only reads the hash; any document shape with one will do.
const probe = Object.assign(parse('query Probe { isCDNEnabled }'), {
  __meta__: { hash: 'sha256:probe' },
});

async function requestWith(prefix: string | null) {
  persistedOperationsPrefix.current = prefix;
  vi.resetModules();
  const { urqlClient } = await import('./urql');
  await urqlClient.query(probe, {}).toPromise();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  // The session lives in cookies on the API origin, so every request has to carry them.
  expect(init.credentials).toBe('include');
  return { method: init.method, body: JSON.parse(init.body as string) as Record<string, unknown> };
}

const location = {
  assign: vi.fn(),
  pathname: '/org-1/view/members',
  search: '',
  protocol: 'http:',
};

function graphqlError(code: string, extensions: Record<string, string> = {}) {
  return new Response(
    JSON.stringify({ errors: [{ message: code, extensions: { code, ...extensions } }] }),
    { headers: { 'content-type': 'application/json' } },
  );
}

describe('urqlClient', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    location.assign.mockClear();
    signOut.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', location);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it(
    'still redirects when the operation re-sent after a refresh needs OIDC',
    { timeout: 30_000 },
    async () => {
      fetchMock
        .mockResolvedValueOnce(graphqlError('NEEDS_REFRESH'))
        .mockResolvedValueOnce(
          graphqlError('NEEDS_OIDC', { organizationSlug: 'org-1', oidcIntegrationId: 'int-1' }),
        );
      persistedOperationsPrefix.current = null;
      vi.resetModules();
      const { urqlClient } = await import('./urql');

      await urqlClient.query(probe, {}).toPromise();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(location.assign).toHaveBeenCalledWith(
        '/org-1/oidc-request?id=int-1&redirectToPath=%2Forg-1%2Fview%2Fmembers',
      );
    },
  );

  it(
    'signs out when the operation re-sent after a refresh is unauthenticated',
    { timeout: 30_000 },
    async () => {
      fetchMock
        .mockResolvedValueOnce(graphqlError('NEEDS_REFRESH'))
        .mockResolvedValueOnce(graphqlError('UNAUTHENTICATED'));
      persistedOperationsPrefix.current = null;
      vi.resetModules();
      const { urqlClient } = await import('./urql');

      await urqlClient.query(probe, {}).toPromise();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      await vi.waitFor(() => {
        expect(signOut).toHaveBeenCalledTimes(1);
        expect(location.assign).toHaveBeenCalledWith(
          '/auth?redirectToPath=%2Forg-1%2Fview%2Fmembers',
        );
      });
    },
  );

  it('sends a query as POST', { timeout: 30_000 }, async () => {
    const { method, body } = await requestWith(null);
    expect(method).toBe('POST');
    expect(body.query).toContain('isCDNEnabled');
  });

  it('sends a persisted operation as POST with its document id', { timeout: 30_000 }, async () => {
    const { method, body } = await requestWith('hive-app/');
    expect(method).toBe('POST');
    expect(body.documentId).toBe('hive-app/sha256:probe');
    expect(body.query).toBeUndefined();
  });
});
