import { ReactElement } from 'react';
import { SessionAuth } from 'supertokens-auth-react/recipe/session';
import { HiveStripeWrapper } from '@/lib/billing/stripe';

/**
 * Utility for wrapping a component with an authenticated container that has the default application layout.
 */
export const authenticated =
  <TProps extends {}>(Component: (props: TProps) => ReactElement | null) =>
  (props: TProps) => {
    return (
      <SessionAuth>
        <HiveStripeWrapper>
          {/* <Header /> */}
          <Component {...props} />
        </HiveStripeWrapper>
      </SessionAuth>
    );
  };
