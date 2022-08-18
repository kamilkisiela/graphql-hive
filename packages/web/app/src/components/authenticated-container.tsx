import type { ReactNode } from 'react';
import ThirdPartyEmailPassword from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import { Header } from './v2';
import { HiveStripeWrapper } from '@/lib/billing/stripe';
import { Provider as UrqlProvider } from 'urql';
import { urqlClient } from '@/lib/urql';

/**
 * Wrapper component for a authenticated route.
 */
export const AuthenticatedContainer = (props: { children: ReactNode }): React.ReactElement => {
  return (
    <>
      <ThirdPartyEmailPassword.ThirdPartyEmailPasswordAuth>
        <UrqlProvider value={urqlClient}>
          <HiveStripeWrapper>
            <Header />
            {props.children}
          </HiveStripeWrapper>
        </UrqlProvider>
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
