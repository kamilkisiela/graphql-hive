import { ReactElement } from 'react';
import cookies from 'js-cookie';
import { LogOutIcon } from 'lucide-react';
import { CombinedError } from 'urql';
import { Button } from '@/components/ui/button';
import { LAST_VISITED_ORG_KEY } from '@/constants';
import { Link, useRouter } from '@tanstack/react-router';

export function QueryError({
  error,
  showError,
  organizationSlug,
}: {
  error: CombinedError;
  showError?: boolean;
  organizationSlug: string | null;
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
    <div className="flex size-full items-center justify-center">
      <Button
        variant="outline"
        onClick={() =>
          router.navigate({
            to: '/logout',
          })
        }
        className="absolute right-6 top-6"
      >
        <LogOutIcon className="mr-2 size-4" /> Sign out
      </Button>
      <div className="flex max-w-[960px] flex-col items-center gap-x-6 sm:flex-row">
        <img src="/images/figures/connection.svg" alt="Ghost" className="block size-[200px]" />
        <div className="grow text-center sm:text-left">
          <h1 className="text-xl font-semibold">Oops, something went wrong.</h1>
          <div className="mt-2">
            {shouldShowError ? (
              <div className="text-sm">{error.graphQLErrors[0].message}</div>
            ) : (
              <div className="text-sm">
                <p>Don't worry, our technical support got this error reported automatically.</p>
                <p>
                  If you wish to track it later or share more details with us,{' '}
                  {organizationSlug ? (
                    <Button variant="link" className="h-auto p-0 text-orange-500" asChild>
                      <Link to="/$organizationSlug/view/support" params={{ organizationSlug }}>
                        you can use the support
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="link" className="h-auto p-0 text-orange-500" asChild>
                      <a href="mailto:support@graphql-hive.com">you can use the support</a>
                    </Button>
                  )}
                  .
                </p>
              </div>
            )}

            {requestId ? (
              <div className="mt-6 text-xs">
                <div className="inline-flex items-center text-gray-300">
                  <div className="rounded-l-sm bg-yellow-500/10 p-2">Error ID</div>
                  <div className="rounded-r-sm bg-yellow-500/5 p-2">{requestId}</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
