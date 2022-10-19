import React from 'react';
import type { ReactNode } from 'react';
import { captureException } from '@sentry/nextjs';
import { Header } from './v2';
import { HiveStripeWrapper } from '@/lib/billing/stripe';
import type { GetServerSideProps } from 'next';
import { SessionContainerInterface } from 'supertokens-node/lib/build/recipe/session/types';
import Session, { SessionAuth } from 'supertokens-auth-react/recipe/session';
import { useRouter } from 'next/router';

/**
 * Wrapper component for a authenticated route.
 */
export const AuthenticatedContainer = (props: { children: ReactNode }): React.ReactElement => {
  return (
    <>
      <SessionAuth>
        <HiveStripeWrapper>
          <Header />
          {props.children}
        </HiveStripeWrapper>
      </SessionAuth>
    </>
  );
};

/**
 * Utility for wrapping a component with an authenticated container that has the default application layout.
 */
export const authenticated =
  <TProps extends { fromSupertokens?: 'needs-refresh' }>(
    Component: (props: Omit<TProps, 'fromSupertokens'>) => React.ReactElement | null
  ) =>
  (props: TProps) => {
    const router = useRouter();

    React.useEffect(() => {
      async function doRefresh() {
        if (props.fromSupertokens === 'needs-refresh') {
          if (await Session.attemptRefreshingSession()) {
            location.reload();
          } else {
            router.replace(`/auth?redirectToPath=${router.asPath}`);
          }
        }
      }
      doRefresh();
    }, []);

    if (props.fromSupertokens) {
      return null;
    }

    return (
      <AuthenticatedContainer>
        <Component {...(props as any)} />
      </AuthenticatedContainer>
    );
  };

export const serverSidePropsSessionHandling = async (context: Parameters<GetServerSideProps>[0]) => {
  const { backendConfig } = await import('@/config/supertokens/backend');
  const SupertokensNode = await import('supertokens-node');
  const Session = await import('supertokens-node/recipe/session');
  SupertokensNode.init(backendConfig());
  let session: SessionContainerInterface | undefined;

  try {
    session = await Session.getSession(context.req, context.res, { sessionRequired: false });
  } catch (err: any) {
    if (err.type === Session.Error.TRY_REFRESH_TOKEN) {
      return { props: { fromSupertokens: 'needs-refresh' } };
    }
    captureException(err);
    throw err;
  }

  if (session === undefined) {
    return {
      redirect: {
        destination: `/auth?redirectToPath=${encodeURIComponent(context.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  return null;
};

function defaultHandler() {
  return Promise.resolve({ props: {} });
}

/**
 * Utility for protecting a server side props function with session handling.
 * Redirects user to the login page in case there is no session.
 */
export function withSessionProtection(handlerFn: GetServerSideProps = defaultHandler) {
  const getServerSideProps: GetServerSideProps = async context => {
    const result = await serverSidePropsSessionHandling(context);

    if (result) {
      return result;
    }

    return handlerFn(context);
  };

  return getServerSideProps;
}
