import { lazy, useEffect, useState } from 'react';
import { EmailVerificationPreBuiltUI } from 'supertokens-auth-react/recipe/emailverification/prebuiltui';
import { ThirdPartyEmailPasswordPreBuiltUI } from 'supertokens-auth-react/recipe/thirdpartyemailpassword/prebuiltui';
import { getRoutingComponent } from 'supertokens-auth-react/ui';
import { FullLogo } from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/meta';
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

  return (
    <div>
      <Meta title="Welcome" />
      <FullLogo
        className="mx-auto my-5 text-yellow-500"
        width={150}
        color={{ main: '#fff', sub: '#fff' }}
      />
      {oidcProvider.id ? (
        <div className="mx-auto max-w-md rounded-md bg-white p-5 text-center">
          {error ? (
            <>
              <div className="text-red-500">{error}</div>
              <div className="mt-3">
                <Button variant="secondary">
                  {/** No NextLink because we want to avoid client side routing for reasons. */}
                  <a href="/auth">Back to login</a>
                </Button>
              </div>
            </>
          ) : (
            <>
              <Spinner className="mx-auto size-20" />
              <div className="mt-3">Starting OIDC Login Flow.</div>
            </>
          )}
        </div>
      ) : (
        <SupertokensLazyComponent />
      )}
    </div>
  );
}
