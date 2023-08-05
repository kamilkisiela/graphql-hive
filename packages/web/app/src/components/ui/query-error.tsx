import { ReactElement } from 'react';
import { useRouter } from 'next/router';
import cookies from 'js-cookie';
import { LogOutIcon } from 'lucide-react';
import { CombinedError } from 'urql';
import { Button } from '@/components/ui/button';
import { LAST_VISITED_ORG_KEY } from '@/constants';
import { openChatSupport } from '@/utils';

export function QueryError({
  error,
  showError,
}: {
  error: CombinedError;
  showError?: boolean;
}): ReactElement {
  const router = useRouter();
  const requestId =
    error &&
    'response' in error &&
    error.response.headers.get('x-request-id')?.split(',')[0].trim();

  cookies.remove(LAST_VISITED_ORG_KEY);

  const containsUnexpectedError = error.message?.includes('Unexpected error');
  const isNetworkError = !!error.networkError;
  const isExpectedError = !isNetworkError && !containsUnexpectedError;
  const shouldShowError = typeof showError === 'boolean' ? showError : isExpectedError;

  return (
    <div className="h-full w-full flex items-center justify-center">
      <Button
        variant="outline"
        onClick={() => router.push('/logout')}
        className="absolute top-6 right-6"
      >
        <LogOutIcon className="mr-2 h-4 w-4" /> Sign out
      </Button>
      <div className="flex sm:flex-row flex-col items-center gap-x-6 max-w-[960px]">
        <img
          src="/images/figures/connection.svg"
          alt="Ghost"
          className="block w-[200px] h-[200px]"
        />
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
                  <Button
                    variant="link"
                    className="h-auto p-0 text-orange-500"
                    onClick={openChatSupport}
                  >
                    you can use the support chat
                  </Button>
                  .
                </p>
              </div>
            )}

            {requestId ? (
              <div className="mt-6 text-xs">
                <div className="inline-flex items-center text-gray-300">
                  <div className="p-2 bg-yellow-500/10 rounded-l-sm">Error ID</div>
                  <div className="p-2 bg-yellow-500/5 rounded-r-sm">{requestId}</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
