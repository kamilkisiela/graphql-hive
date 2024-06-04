import { useCallback } from 'react';
import { useMutation, useQuery } from 'urql';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/meta';
import { DataWrapper } from '@/components/v2/data-wrapper';
import { graphql } from '@/gql';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { cn } from '@/lib/utils';
import { useRouter } from '@tanstack/react-router';

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
        cleanId
        name
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

export function OrganizationTransferPage(props: { organizationId: string; code: string }) {
  const router = useRouter();
  const notify = useNotifications();
  const orgId = props.organizationId;
  const code = props.code;
  const [query] = useQuery({
    query: OrganizationTransferPage_GetRequest,
    variables: {
      selector: {
        organization: orgId,
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
          organization: orgId,
          accept,
        },
      });
      if (result.data?.answerOrganizationTransferRequest) {
        if (result.data.answerOrganizationTransferRequest.ok) {
          if (accept) {
            notify('The organization is now yours!', 'success');
          }
          void router.navigate({
            to: '/$organizationId',
            params: {
              organizationId: orgId,
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
    [mutate, orgId, code, router, notify],
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
      <DataWrapper query={query} organizationId={props.organizationId}>
        {({ data }) => (
          <div className="flex size-full flex-row items-center justify-center">
            <div className="flex w-full flex-col text-center md:w-2/3">
              {data.organizationTransferRequest == null ? (
                <>
                  <h1 className={classes.title}>Organization Transfer Error</h1>
                  <p className={classes.description}>Not found</p>

                  <div className={classes.actions}>
                    <Button size="lg" variant="secondary" onClick={goBack}>
                      Back to Hive
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h1 className={classes.title}>Accept the transfer?</h1>
                  <p className={classes.description}>
                    {data.organizationTransferRequest.organization.owner.user.displayName} wants to
                    transfer the "{data.organizationTransferRequest.organization.name}" organization
                    to you.
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
        )}
      </DataWrapper>
    </>
  );
}
