import { ReactElement, useEffect } from 'react';
import { useRouter } from 'next/router';
import Session, { SessionAuth } from 'supertokens-auth-react/recipe/session';
import { HiveStripeWrapper } from '@/lib/billing/stripe';

/**
 * Utility for wrapping a component with an authenticated container that has the default application layout.
 */
export const authenticated =
  <TProps extends { fromSupertokens?: 'needs-refresh' }>(
    Component: (props: Omit<TProps, 'fromSupertokens'>) => ReactElement | null,
  ) =>
  (props: TProps) => {
    const router = useRouter();

    useEffect(() => {
      async function doRefresh() {
        if (props.fromSupertokens === 'needs-refresh') {
          if (await Session.attemptRefreshingSession()) {
            location.reload();
          } else {
            void router.replace(`/auth?redirectToPath=${router.asPath}`);
          }
        }
      }

      void doRefresh();
    }, []);

    if (props.fromSupertokens) {
      return null;
    }

    return (
      <SessionAuth>
        <HiveStripeWrapper>
          {/* <Header /> */}
          <Component {...props} />
        </HiveStripeWrapper>
      </SessionAuth>
    );
  };
