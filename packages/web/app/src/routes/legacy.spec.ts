// @vitest-environment jsdom
import { createTestClient } from '@/lib/testing/urql';
import { createMemoryHistory } from '@tanstack/react-router';

// The tree imports every page; these stand in for what cannot load under jsdom.
vi.mock('@/env/frontend', () => import('@/lib/testing/mocks/env'));
// Signed in unless a case says otherwise: the authenticated gate runs before every redirect below.
const sessionExists = vi.hoisted(() => ({ current: true }));
vi.mock('@/lib/auth/session', async () => ({
  ...(await import('@/lib/testing/mocks/auth-session')),
  doesSessionExist: async () => sessionExists.current,
}));
vi.mock('@graphql-hive/laboratory', () => import('@/lib/testing/mocks/laboratory'));
vi.mock(
  '@/lib/laboratory-history-storage',
  () => import('@/lib/testing/mocks/laboratory-history-storage'),
);
// Stripe on, so the old subscription URL lands on the billing page instead of the organization.
vi.mock('@/lib/billing/stripe-public-key', () => ({
  getStripePublicKey: () => 'pk_test',
  getIsStripeEnabled: () => true,
}));

async function loadAt(url: string, client = createTestClient()) {
  const { createAppRouter } = await import('@/router');
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [url] }),
    urqlClient: client,
  });
  await router.load();
  return router;
}

describe('legacy URLs', () => {
  beforeEach(() => {
    sessionExists.current = true;
  });

  it('has an entry for every old URL shape', { timeout: 30_000 }, async () => {
    const { legacyPaths, legacySearch } = await import('./legacy');
    expect(legacyPaths.map(entry => entry.path)).toMatchInlineSnapshot(`
      [
        trace/$traceId,
        view/manage-subscription,
        activity,
      ]
    `);
    expect(Object.keys(legacySearch)).toMatchInlineSnapshot(`
      [
        targetSettings,
        organizationSettings,
        projectSettings,
        organizationMembers,
      ]
    `);
  });

  it('lands each example on its new URL without a history entry', { timeout: 30_000 }, async () => {
    const { legacyPaths } = await import('./legacy');
    for (const { example } of legacyPaths) {
      const router = await loadAt(example.from);
      // The example's search must carry over; a landing route may add its own (alerts adds a range).
      const expected = new URL(example.to, 'http://localhost');
      expect({ from: example.from, to: router.state.location.pathname }).toEqual({
        from: example.from,
        to: expected.pathname,
      });
      expect(router.state.location.search).toMatchObject(Object.fromEntries(expected.searchParams));
      expect(router.history.length).toBe(1);
    }
  });

  it('lands each old search form on its section path', { timeout: 30_000 }, async () => {
    const { legacySearch } = await import('./legacy');
    for (const entry of Object.values(legacySearch)) {
      for (const example of entry.examples) {
        const router = await loadAt(example.from);
        expect({ from: example.from, to: router.state.location.href }).toEqual({
          from: example.from,
          to: example.to,
        });
        expect(router.history.length).toBe(1);
      }
    }
  });

  it('sends /auth to sign-in with the return path', { timeout: 30_000 }, async () => {
    const router = await loadAt('/auth?redirectToPath=%2Facme');
    expect(router.state.location.pathname).toBe('/auth/sign-in');
    expect(router.state.location.search).toEqual({ redirectToPath: '/acme' });
  });

  // The env mock enables no auth provider.
  it('skips the OIDC interstitial when the provider is off', { timeout: 30_000 }, async () => {
    const router = await loadAt('/acme/oidc-request?id=oidc-1&redirectToPath=%2Facme%2Fshop');
    expect(router.state.location.pathname).toBe('/acme/shop');
  });

  // `redirectToPath` is whatever the link said; only a path on this app may be followed.
  it.each(['https%3A%2F%2Fevil.example', '%2F%2Fevil.example', '%2F%5Cevil.example'])(
    'sends a hostile redirectToPath home instead: %s',
    { timeout: 30_000 },
    async encoded => {
      const auth = await loadAt(`/auth?redirectToPath=${encoded}`);
      expect(auth.state.location.pathname).toBe('/auth/sign-in');
      expect(auth.state.location.search).toEqual({ redirectToPath: '/' });

      const oidc = await loadAt(`/acme/oidc-request?id=oidc-1&redirectToPath=${encoded}`);
      expect(oidc.state.location.pathname).toBe('/');
    },
  );

  it(
    'sends a signed-out visitor to sign in, before any loader runs',
    { timeout: 30_000 },
    async () => {
      sessionExists.current = false;
      const client = createTestClient();

      const router = await loadAt('/acme/shop/prod', client);

      expect(router.state.location.pathname).toBe('/auth/sign-in');
      expect(router.state.location.search).toEqual({ redirectToPath: '/acme/shop/prod' });
      expect(client.seen).toEqual([]);
    },
  );
});
