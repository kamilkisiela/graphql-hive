import { lazy, Suspense, useEffect } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { Provider as UrqlProvider, type Client } from 'urql';
import { LoadingAPIIndicator } from '@/components/common/LoadingAPI';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { NotFound } from '@/components/ui/not-found/not-found';
import { TooltipProvider } from '@/components/ui/primitives/floating/tooltip/tooltip';
import { ToastProvider } from '@/components/ui/primitives/toast/toast';
import { getSession } from '@/lib/auth/session';
import { LogoutPage } from '@/pages/logout';
import { JoinOrganizationPage } from '@/pages/organization-join';
import { captureMessage, getCurrentScope } from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRouteWithContext, createRoute, Outlet, useRouter } from '@tanstack/react-router';

const queryClient = new QueryClient();

const LazyTanStackRouterDevtools = lazy(() =>
  import('@tanstack/react-router-devtools').then(({ TanStackRouterDevtools }) => ({
    default: TanStackRouterDevtools,
  })),
);

function identifyOnSentry(userId: string, email: string | undefined): void {
  getCurrentScope().setUser({ id: userId, email });
}

function RootComponent() {
  const { urqlClient } = root.useRouteContext();

  useEffect(() => {
    const session = getSession();
    if (session) {
      identifyOnSentry(session.userId, session.email);
    }
  }, []);

  return (
    <ThemeProvider>
      <TooltipProvider>
        <ToastProvider>
          <HelmetProvider>
            <QueryClientProvider client={queryClient}>
              <UrqlProvider value={urqlClient}>
                <LoadingAPIIndicator />
                <Outlet />
              </UrqlProvider>
            </QueryClientProvider>
            {/* eslint-disable-next-line no-process-env */}
            {process.env.NODE_ENV === 'development' && (
              <Suspense fallback={null}>
                <LazyTanStackRouterDevtools />
              </Suspense>
            )}
          </HelmetProvider>
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

function NotFoundPage(props: { fullScreen: boolean }) {
  const router = useRouter();

  captureMessage('404 Not Found', {
    level: 'warning',
    extra: {
      href1: router.history.location.href,
      href2: window.location.href,
      href3: router.latestLocation.href,
    },
  });

  return (
    <NotFound bigHeading="404" title="Page Not Found" variants={{ fullScreen: props.fullScreen }} />
  );
}

/**
 * The router's `defaultNotFoundComponent`, so it renders where the missing page would have: inside
 * the chrome of whichever layout matched. Only the standalone `/404` fills the viewport.
 */
export function RouteNotFound() {
  return <NotFoundPage fullScreen={false} />;
}

// The urql client comes in through router context, so `main.tsx` passes the real one and a spec
// passes a test client without mocking a module.
export const root = createRootRouteWithContext<{ urqlClient: Client }>()({
  component: RootComponent,
});

// Routes that sit outside both the anonymous and the authenticated gates.

export const notFoundRoute = createRoute({
  getParentRoute: () => root,
  path: '404',
  component: function NotFoundRoute() {
    return <NotFoundPage fullScreen />;
  },
});

export const logoutRoute = createRoute({
  getParentRoute: () => root,
  path: 'logout',
  component: LogoutPage,
});

export const joinOrganizationRoute = createRoute({
  getParentRoute: () => root,
  path: 'join/$inviteCode',
  component: function JoinOrganizationRoute() {
    const { inviteCode } = joinOrganizationRoute.useParams();
    return <JoinOrganizationPage inviteCode={inviteCode} />;
  },
});
