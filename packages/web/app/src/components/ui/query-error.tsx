import { ReactElement } from 'react';
import cookies from 'js-cookie';
import { LogOutIcon } from 'lucide-react';
import { CombinedError } from 'urql';
import { commonErrorStrings } from '@/components/error';
import { Button } from '@/components/ui/primitives/button/button';
import { LAST_VISITED_ORG_KEY } from '@/constants';
import { cn } from '@/lib/utils';
import { Link, useRouter } from '@tanstack/react-router';
import * as styles from './query-error.css';

export function QueryError({
  error,
  showError,
  organizationSlug,
  showLogoutButton = true,
  className,
}: {
  error: CombinedError;
  showError?: boolean;
  organizationSlug: string | null;
  showLogoutButton?: boolean;
  className?: string;
}): ReactElement {
  const router = useRouter();
  const requestId =
    error &&
    'response' in error &&
    error?.response?.headers?.get('x-request-id')?.split(',')[0].trim();

  cookies.remove(LAST_VISITED_ORG_KEY);

  const containsUnexpectedError = error.message?.includes('Unexpected error');
  const isNetworkError = !!error.networkError;
  const isExpectedError = !isNetworkError && !containsUnexpectedError;
  const shouldShowError = typeof showError === 'boolean' ? showError : isExpectedError;

  return (
    <div className={cn(styles.queryErrorDiv, className)}>
      {showLogoutButton && (
        <div className={styles.queryErrorDiv2}>
          <Button
            variant="outline"
            onClick={() =>
              router.navigate({
                to: '/logout',
              })
            }
          >
            <LogOutIcon className={styles.queryErrorLogOutIcon} /> Sign out
          </Button>
        </div>
      )}
      <div className={styles.queryErrorDiv3}>
        <img src="/images/figures/connection.svg" alt="Ghost" className={styles.queryErrorImg} />
        <div className={styles.queryErrorDiv4}>
          <h1 className={styles.queryErrorH1}>Oops, something went wrong.</h1>
          <div className={styles.queryErrorDiv5}>
            {shouldShowError ? (
              <div className={styles.queryErrorDiv6}>
                {error.graphQLErrors?.[0]?.message ?? error.message}
              </div>
            ) : (
              <div className={styles.queryErrorDiv7}>
                <p>{commonErrorStrings.reported}</p>
                <p>
                  {commonErrorStrings.track}{' '}
                  {organizationSlug ? (
                    <Button
                      variant="link"
                      render={
                        <Link to="/$organizationSlug/view/support" params={{ organizationSlug }} />
                      }
                    >
                      {commonErrorStrings.link}
                    </Button>
                  ) : (
                    <Button variant="link" anchor={{ href: 'mailto:support@graphql-hive.com' }}>
                      {commonErrorStrings.link}
                    </Button>
                  )}
                  .
                </p>
              </div>
            )}

            {requestId ? (
              <div className={styles.queryErrorDiv8}>
                <div className={styles.queryErrorDiv9}>
                  <div className={styles.queryErrorDiv10}>Error ID</div>
                  <div className={styles.queryErrorDiv11}>{requestId}</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
