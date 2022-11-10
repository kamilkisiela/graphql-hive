import React from 'react';
import type { ReactNode } from 'react';
import { Header } from './v2';
import { HiveStripeWrapper } from '@/lib/billing/stripe';
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
    Component: (props: Omit<TProps, 'fromSupertokens'>) => React.ReactElement | null,
  ) =>
  (props: TProps) => {
    const router = useRouter();

    React.useEffect(() => {
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
      <AuthenticatedContainer>
        <Component {...(props as any)} />
      </AuthenticatedContainer>
    );
  };
