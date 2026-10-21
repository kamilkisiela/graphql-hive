// @vitest-environment jsdom
import { createTestClient } from '@/lib/testing/urql';

// The route tree imports every page. These stand in for the modules that cannot load under jsdom
// or that read the frontend env at import time.
vi.mock('@/env/frontend', () => import('@/lib/testing/mocks/env'));
vi.mock('@graphql-hive/laboratory', () => import('@/lib/testing/mocks/laboratory'));
vi.mock(
  '@/lib/laboratory-history-storage',
  () => import('@/lib/testing/mocks/laboratory-history-storage'),
);

// The real client belongs to `main.tsx`; the router only carries whatever client it is given.
vi.mock('@/lib/urql', () => {
  throw new Error('the router module must not import @/lib/urql');
});

const sentryInit = vi.hoisted(() => vi.fn());
vi.mock('@sentry/react', async importOriginal => ({
  ...(await importOriginal<typeof import('@sentry/react')>()),
  init: sentryInit,
}));

// The dynamic import below is cached across the cases, so the stub has to be in place before the first one.
const fetchSpy = vi.fn();
beforeAll(() => {
  vi.stubGlobal('fetch', fetchSpy);
});
afterAll(() => {
  vi.unstubAllGlobals();
});

describe('router module', () => {
  it(
    'can be imported without initializing Sentry or touching the network',
    { timeout: 30_000 },
    async () => {
      const { createAppRouter } = await import('./router');
      const router = createAppRouter({ urqlClient: createTestClient() });

      expect(router.routeTree).toBeDefined();
      expect(sentryInit).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('carries the urql client it is given in route context', { timeout: 30_000 }, async () => {
    const { createAppRouter } = await import('./router');
    const client = createTestClient();
    const router = createAppRouter({ urqlClient: client });

    expect(router.options.context.urqlClient).toBe(client);
  });

  it(
    'configures the pending spinner as the default after 250 ms',
    { timeout: 30_000 },
    async () => {
      const { createAppRouter } = await import('./router');
      const router = createAppRouter({ urqlClient: createTestClient() });
      const { PagePending } = await import('@/components/layouts/page-pending');

      expect(router.options.defaultPendingComponent).toBe(PagePending);
      expect(router.options.defaultPendingMs).toBe(250);
    },
  );

  it('preloads routes on intent', { timeout: 30_000 }, async () => {
    const { createAppRouter } = await import('./router');
    const router = createAppRouter({ urqlClient: createTestClient() });

    expect(router.options.defaultPreload).toBe('intent');
  });

  it('owns the error and not-found boundaries for every route', { timeout: 30_000 }, async () => {
    const { createAppRouter } = await import('./router');
    const router = createAppRouter({ urqlClient: createTestClient() });
    const { ErrorComponent } = await import('@/components/error');
    const { RouteNotFound } = await import('./routes/root');

    expect(router.options.defaultErrorComponent).toBe(ErrorComponent);
    expect(router.options.defaultNotFoundComponent).toBe(RouteNotFound);

    const overriding = Object.values(router.routesById)
      .filter(route => route.options.errorComponent || route.options.notFoundComponent)
      .map(route => route.id);
    expect(overriding).toEqual([]);
  });
});
