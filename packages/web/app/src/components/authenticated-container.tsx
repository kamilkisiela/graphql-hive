import { ReactElement } from 'react';
import { SessionAuth } from 'supertokens-auth-react/recipe/session';
import { HivePaddleProvider } from '@/lib/billing/paddle';

/**
 * Utility for wrapping a component with an authenticated container that has the default application layout.
 */
export const authenticated =
  <TProps extends {}>(Component: (props: TProps) => ReactElement | null) =>
  (props: TProps) => {
    return (
      <SessionAuth>
        <HivePaddleProvider>
          <Component {...props} />
        </HivePaddleProvider>
      </SessionAuth>
    );
  };
