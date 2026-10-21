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
vi.mock('@/lib/auth/session', () => ({
  attemptRefreshingSession: async () => true,
  signOut: async () => {},
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

describe('urqlClient', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
