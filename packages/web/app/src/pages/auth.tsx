import { BookIcon } from 'lucide-react';
import { SiGithub } from 'react-icons/si';
import { useSessionContext } from 'supertokens-auth-react/recipe/session';
import { Meta } from '@/components/ui/meta';
import { HiveLogo } from '@/components/v2/icon';
import { Outlet } from '@tanstack/react-router';
import { Spinner } from '@/components/ui/spinner';
import { env } from '@/env/frontend';
import { useBrowser } from '@/lib/hooks/use-browser';
import { startAuthFlowForProvider } from '@/lib/supertokens/start-auth-flow-for-provider';
import { startAuthFlowForOIDCProvider } from '@/lib/supertokens/third-party-email-password-react-oidc-provider';
import { useRouter } from '@tanstack/react-router';

const supertokenRoutes = new Set([
  '/auth/verify-email',
  '/auth/reset-password',
  '/auth/login',
  '/auth',
]);

if (env.auth.github) {
  supertokenRoutes.add('/auth/callback/github');
}
if (env.auth.google) {
  supertokenRoutes.add('/auth/callback/google');
}
if (env.auth.okta) {
  supertokenRoutes.add('/auth/callback/okta');
}
if (env.auth.organizationOIDC) {
  supertokenRoutes.add('/auth/oidc');
  supertokenRoutes.add('/auth/callback/oidc');
}

function useOidcProviderId() {
  if (typeof window === 'undefined') {
    return {
      loading: true,
    } as const;
  }

  const url = new URL(window.location.href, env.appBaseUrl);

  if (!supertokenRoutes.has(url.pathname)) {
    return {
      loading: false,
      notFound: true,
    } as const;
  }

  if (env.auth.organizationOIDC === true) {
    const id = url.searchParams.get('id');

    if (url.pathname === '/auth/oidc') {
      if (!id) {
        return {
          loading: false,
          notFound: true,
        } as const;
      }

      return {
        loading: false,
        id,
      } as const;
    }
  }

  return {
    loading: false,
    id: null,
  } as const;
}

function SupertokensRoutingComponent() {
  const routingComponent = getRoutingComponent([
    ThirdPartyEmailPasswordPreBuiltUI,
    EmailVerificationPreBuiltUI,
  ]);

  return <>{routingComponent}</>;
}

const SupertokensLazyComponent = lazy(() =>
  Promise.resolve({
    default: SupertokensRoutingComponent,
  }),
);

const isOkta = () =>
  env.auth.okta !== null &&
  new URLSearchParams(globalThis.window?.location.search ?? '').get('provider') === 'okta';

/**
 * Route for showing the SuperTokens login page.
 */
export function AuthPage() {
  const [error, setError] = useState<string | null>(null);
  const oidcProvider = useOidcProviderId();

  useEffect(() => {
    let task: null | Promise<void> = null;

    if (oidcProvider.loading) {
      return;
    }

    if ('id' in oidcProvider && oidcProvider.id) {
      task = startAuthFlowForOIDCProvider(oidcProvider.id);
    } else if (
      // In case we are directed here from the Okta dashboard we automatically start the login flow.
      isOkta()
    ) {
      task = startAuthFlowForProvider('okta');
    }

    task?.catch((err: unknown) => {
      if (err instanceof Error) {
        setError(err.message);
        return;
      }
      setError('An unexpected error occurred.');
    });
  }, [oidcProvider]);

  const router = useRouter();
  const isBrowser = useBrowser();

  if (!isBrowser) {
    return null;
  }

  if (oidcProvider.loading) {
    return null;
  }

  if (oidcProvider.notFound) {
    void router.navigate({
      to: '/404',
    });
    return null;
  }

  function ExternalLink(props: { href: string; children: React.ReactNode }) {
    return (
      <a
        href={props.href}
        className="group relative isolate flex flex-none items-center gap-x-3 rounded-lg px-2 py-0.5 text-[0.8125rem]/6 font-medium text-white/30 transition-colors hover:text-orange-500"
      >
        <span className="absolute inset-0 -z-10 scale-75 rounded-lg bg-white/5 opacity-0 transition group-hover:scale-100 group-hover:opacity-100" />
        {props.children}
      </a>
    );
  }

  export function AuthPage() {
    const session = useSessionContext();

    return (
      <>
        <Meta title="Welcome" />

        <div className="size-full">
          <>
            {session.loading ? (
              <div className="flex size-full items-center justify-center">
                <HiveLogo animated={false} className="size-8 animate-pulse" />
              </div>
            ) : (
              <div className="grid h-full items-center justify-center md:grid-cols-2 lg:max-w-none lg:grid-cols-3 lg:px-0">
                <div className="bg-muted relative hidden h-full flex-col p-10 text-white lg:flex dark:border-r">
                  <div className="absolute inset-0 bg-[#101014]" />
                  <div className="relative z-20 flex items-center text-lg font-medium">
                    <HiveLogo animated={false} className="mr-2 size-6" />
                    GraphQL Hive
                  </div>
                  <div className="relative flex h-full flex-row items-center justify-center">
                    <div className="max-w-xs md:max-w-none">
                      <h1 className="text-balance font-light text-white md:text-2xl/tight lg:text-3xl/tight">
                        Open-source <span className="text-orange-500">GraphQL</span> management
                        platform
                      </h1>
                      <p className="mt-4 text-balance text-sm/6 text-gray-300">
                        Prevent breaking changes, monitor performance of your GraphQL API, and manage
                        your API gateway
                      </p>
                      <div className="mt-8 flex flex-wrap justify-center gap-x-1 gap-y-3 sm:gap-x-2 lg:justify-start">
                        <ExternalLink href="https://the-guild.dev/graphql/hive/docs">
                          <BookIcon className="size-4 flex-none" />
                          <span className="self-baseline text-white">Documentation</span>
                        </ExternalLink>
                        <ExternalLink href="https://github.com/kamilkisiela/graphql-hive">
                          <SiGithub className="size-4 flex-none" />
                          <span className="self-baseline text-white">Github</span>
                        </ExternalLink>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-span-2">
                  <Outlet />
                </div>
              </div>
            )}
          </>
        </div>
      </>
    );
  }
