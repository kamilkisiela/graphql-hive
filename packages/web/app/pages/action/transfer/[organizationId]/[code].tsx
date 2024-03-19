import { useCallback } from 'react';
import { clsx } from 'clsx';
import { useMutation, useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Title } from '@/components/common';
import { Button, DataWrapper } from '@/components/v2';
import { graphql } from '@/gql';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const classes = {
  title: clsx('sm:text-4xl text-3xl mb-4 font-medium text-white'),
  description: clsx('mb-8 leading-relaxed'),
  actions: clsx('flex flex-row gap-2 items-center justify-center'),
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

function OrganizationTransferPage() {
  const router = useRouteSelector();
  const notify = useNotifications();
  const orgId = router.query.organizationId as string;
  const code = router.query.code as string;
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
          void router.visitOrganization({
            organizationId: orgId,
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
    void router.visitHome();
  }, [router]);

  return (
    <>
      <Title title="Organization Transfer" />
      <DataWrapper query={query}>
        {({ data }) => (
          <div className="flex size-full flex-row items-center justify-center">
            <div className="flex w-full flex-col text-center md:w-2/3">
              {data.organizationTransferRequest == null ? (
                <>
                  <h1 className={classes.title}>Organization Transfer Error</h1>
                  <p className={classes.description}>Not found</p>

                  <div className={classes.actions}>
                    <Button size="large" variant="secondary" onClick={goBack}>
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
                      size="large"
                      variant="primary"
                      onClick={accept}
                      disabled={mutation.fetching}
                    >
                      Accept
                    </Button>
                    <Button size="large" danger onClick={reject} disabled={mutation.fetching}>
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

export default authenticated(OrganizationTransferPage);
