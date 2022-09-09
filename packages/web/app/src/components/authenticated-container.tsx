import type { ReactNode } from 'react';
import ThirdPartyEmailPassword from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import { captureException } from '@sentry/nextjs';
import { Header } from './v2';
import { HiveStripeWrapper } from '@/lib/billing/stripe';
import type { GetServerSideProps } from 'next';

/**
 * Wrapper component for a authenticated route.
 */
export const AuthenticatedContainer = (props: { children: ReactNode }): React.ReactElement => {
  return (
    <>
      <ThirdPartyEmailPassword.ThirdPartyEmailPasswordAuth>
        <HiveStripeWrapper>
          <Header />
          {props.children}
        </HiveStripeWrapper>
      </ThirdPartyEmailPassword.ThirdPartyEmailPasswordAuth>
    </>
  );
};

/**
 * Utility for wrapping a component with an authenticated container that has the default application layout.
 */
export const authenticated =
  <TProps,>(Component: (props: TProps) => React.ReactElement | null) =>
  (props: TProps) =>
    (
      <AuthenticatedContainer>
        <Component {...props} />
      </AuthenticatedContainer>
    );

export const serverSidePropsSessionHandling = async (context: Parameters<GetServerSideProps>[0]) => {
  const { backendConfig } = await import('@/config/backend-config');
  const SupertokensNode = await import('supertokens-node');
  const Session = await import('supertokens-node/recipe/session');
  SupertokensNode.init(backendConfig());
  const session = await Session.getSession(context.req, context.res, { sessionRequired: false }).catch(err => {
    captureException(err);
    return Promise.reject(err);
  });

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
