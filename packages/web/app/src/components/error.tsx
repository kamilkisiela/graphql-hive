import { useEffect } from 'react';
import { LogOutIcon } from 'lucide-react';
import { useSessionContext } from 'supertokens-auth-react/recipe/session';
import { Button } from '@/components/ui/button';
import { captureException, flush } from '@sentry/react';
import { useRouter } from '@tanstack/react-router';

export function ErrorComponent(props: { error: any; message?: string }) {
  const router = useRouter();
  const session = useSessionContext();

  useEffect(() => {
    captureException(props.error);
    void flush(2000);
  }, []);

  const isLoggedIn = !session.loading && session.doesSessionExist;

  return (
    <div className="flex size-full items-center justify-center">
      {isLoggedIn ? (
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
      ) : null}
      <div className="flex max-w-[960px] flex-col items-center gap-x-6 sm:flex-row">
        <img src="/images/figures/connection.svg" alt="Ghost" className="block size-[200px]" />
        <div className="grow text-center sm:text-left">
          <h1 className="text-xl font-semibold">
            {props.message || 'Oops, something went wrong.'}
          </h1>
          <div className="mt-2">
            <div className="text-sm">
              <p>Don't worry, our technical support got this error reported automatically.</p>
              <p>
                If you wish to track it later or share more details with us,{' '}
                <Button variant="link" className="h-auto p-0 text-orange-500" asChild>
                  <a href="mailto:support@graphql-hive.com">you can use the support</a>
                </Button>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
