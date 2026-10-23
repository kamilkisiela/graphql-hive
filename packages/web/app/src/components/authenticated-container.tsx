import { ReactElement } from 'react';
import { HiveStripeWrapper } from '@/lib/billing/stripe';

/**
 * Utility for wrapping a component with an authenticated container that has the default application layout.
 */
export const authenticated =
  <TProps extends Record<string, any>>(Component: (props: TProps) => ReactElement | null) =>
  (props: TProps) => {
    return (
      <HiveStripeWrapper>
        <Component {...props} />
      </HiveStripeWrapper>
    );
  };
