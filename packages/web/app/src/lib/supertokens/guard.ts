import { captureException } from '@sentry/nextjs';
import type { GetServerSideProps } from 'next';
import type { SessionContainerInterface } from 'supertokens-node/lib/build/recipe/session/types';

export const serverSidePropsSessionHandling = async (context: Parameters<GetServerSideProps>[0]) => {
  const { backendConfig } = await import('@/config/supertokens/backend');
  const SupertokensNode = await import('supertokens-node');
  const Session = await import('supertokens-node/recipe/session');
  SupertokensNode.init(backendConfig());
  let session: SessionContainerInterface | undefined;

  try {
    session = await Session.getSession(context.req, context.res, { sessionRequired: false });
    // TODO: better error decoding :)
  } catch (err: any) {
    // Check whether the email is already verified.
    // If it is not then we need to redirect to the email verification page - which will trigger the email sending.
    if (err.type === Session.Error.INVALID_CLAIMS) {
      return {
        redirect: {
          destination: '/auth/verify-email',
          permanent: false,
        },
      };
    }

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
