import { useCallback } from 'react';
import { LoaderCircleIcon, LogOutIcon } from 'lucide-react';
import { useMutation, useQuery } from 'urql';
import { Button } from '@/components/ui/button';
import { DottedBackground } from '@/components/ui/dotted-background';
import { HiveLogo } from '@/components/ui/icon';
import { Meta } from '@/components/ui/meta';
import { graphql } from '@/gql';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { cn } from '@/lib/utils';
import { Link, useRouter } from '@tanstack/react-router';

const classes = {
  title: cn('sm:text-4xl text-3xl mb-4 font-medium text-white'),
  description: cn('mb-8 leading-relaxed'),
  actions: cn('flex flex-row gap-2 items-center justify-center'),
};

const OrganizationTransferPage_GetRequest = graphql(`
  query OrganizationTransferPage_GetRequest($selector: OrganizationTransferRequestSelector!) {
    organizationTransferRequest(selector: $selector) {
      organization {
        id
        slug
        owner {
          id
          user {
            id
            displayName
          }
        }
      }
    }
  }
`);

const OrganizationTransferPage_AnswerRequest = graphql(`
  mutation OrganizationTransferPage_AnswerRequest($input: AnswerOrganizationTransferRequestInput!) {
    answerOrganizationTransferRequest(input: $input) {
      ok {
        accepted
      }
      error {
        message
      }
    }
  }
`);

export function OrganizationTransferPage(props: { organizationSlug: string; code: string }) {
  const router = useRouter();
  const notify = useNotifications();
  const code = props.code;
  const [query] = useQuery({
    query: OrganizationTransferPage_GetRequest,
    variables: {
      selector: {
        organizationSlug: props.organizationSlug,
        code,
      },
    },
  });
  const [mutation, mutate] = useMutation(OrganizationTransferPage_AnswerRequest);
  const answer = useCallback(
    async (accept: boolean) => {
      const result = await mutate({
        input: {
          code,
          organizationSlug: props.organizationSlug,
          accept,
        },
      });
      if (result.data?.answerOrganizationTransferRequest) {
        if (result.data.answerOrganizationTransferRequest.ok) {
          if (accept) {
            notify('The organization is now yours!', 'success');
          }
          void router.navigate({
            to: '/$organizationSlug',
            params: {
              organizationSlug: props.organizationSlug,
            },
          });
        } else {
          notify(result.data.answerOrganizationTransferRequest.error!.message, 'error');
        }
      }

      if (result.error) {
        notify('Failed to answer', 'error');
      }
    },
    [mutate, props.organizationSlug, code, router, notify],
  );

  const accept = useCallback(() => answer(true), [answer]);
  const reject = useCallback(() => answer(false), [answer]);

  const goBack = useCallback(() => {
    void router.navigate({
      to: '/',
    });
  }, [router]);

  return (
    <>
      <Meta title="Organization Transfer" />
      <DottedBackground className="min-h-[100vh]">
        <div className="flex h-full grow items-center">
          <Button
            variant="outline"
            onClick={() =>
              void router.navigate({
                to: '/logout',
              })
            }
            className="absolute right-6 top-6"
          >
            <LogOutIcon className="mr-2 size-4" /> Sign out
          </Button>
          <Link to="/" className="absolute left-6 top-6">
            <HiveLogo className="size-10" />
          </Link>
          <div className="flex size-full flex-row items-center justify-center">
            <div className="flex w-full flex-col text-center md:w-2/3">
              {query.stale || query.fetching ? (
                <div>
                  <LoaderCircleIcon className="mr-2 inline size-8 animate-spin" />
                  Loading
                </div>
              ) : query.error ? (
                <>
                  <h1 className={classes.title}>Organization Transfer Error</h1>
                  <p>{query.error.message}</p>

                  <p className={classes.description}>
                    Please make sure you are signed-in with the correct account for this
                    organization.
                  </p>

                  <div className={classes.actions}>
                    <Button size="lg" onClick={goBack}>
                      Back to Hive
                    </Button>
                    <Button asChild size="lg">
                      <Link to="/logout">Sign Out</Link>
                    </Button>
                  </div>
                </>
              ) : !query?.data?.organizationTransferRequest ? (
                <>
                  <h1 className={classes.title}>Organization Transfer Error</h1>
                  <p className={classes.description}>Not found</p>

                  <div className={classes.actions}>
                    <Button size="lg" onClick={goBack}>
                      Back to Hive
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h1 className={classes.title}>Accept the transfer?</h1>
                  <p className={classes.description}>
                    {query.data.organizationTransferRequest.organization.owner.user.displayName}{' '}
                    wants to transfer the "
                    {query.data.organizationTransferRequest.organization.slug}" organization to you.
                  </p>

                  <div className={classes.actions}>
                    <Button
                      size="lg"
                      variant="default"
                      onClick={accept}
                      disabled={mutation.fetching}
                    >
                      Accept
                    </Button>
                    <Button
                      size="lg"
                      variant="destructive"
                      onClick={reject}
                      disabled={mutation.fetching}
                    >
                      Reject
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DottedBackground>
    </>
  );
}
