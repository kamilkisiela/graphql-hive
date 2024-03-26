import { useCallback } from 'react';
import { useMutation, useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Title } from '@/components/common';
import { Button, DataWrapper } from '@/components/v2';
import { graphql } from '@/gql';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { cn } from '@/lib/utils';

const classes = {
  title: cn('sm:text-4xl text-3xl mb-4 font-medium text-white'),
  description: cn('mb-8 leading-relaxed'),
  actions: cn('flex flex-row gap-2 items-center justify-center'),
};

const JoinOrganizationPage_JoinOrganizationMutation = graphql(`
  mutation JoinOrganizationPage_JoinOrganizationMutation($code: String!) {
    joinOrganization(code: $code) {
      __typename
      ... on OrganizationPayload {
        selector {
          organization
        }
        organization {
          id
          name
          cleanId
        }
      }
      ... on OrganizationInvitationError {
        message
      }
    }
  }
`);

const JoinOrganizationPage_OrganizationInvitationQuery = graphql(`
  query JoinOrganizationPage_OrganizationInvitationQuery($code: String!) {
    organizationByInviteCode(code: $code) {
      __typename
      ... on OrganizationInvitationPayload {
        name
      }
      ... on OrganizationInvitationError {
        message
      }
    }
  }
`);

function JoinOrganizationPage() {
  const router = useRouteSelector();
  const notify = useNotifications();
  const code = router.query.inviteCode as string;
  const [query] = useQuery({
    query: JoinOrganizationPage_OrganizationInvitationQuery,
    variables: { code },
  });
  const [mutation, mutate] = useMutation(JoinOrganizationPage_JoinOrganizationMutation);
  const accept = useCallback(async () => {
    const result = await mutate({ code });
    if (result.data) {
      if (result.data.joinOrganization.__typename === 'OrganizationInvitationError') {
        notify(result.data.joinOrganization.message, 'error');
      } else {
        const org = result.data.joinOrganization.organization;
        notify(`You joined "${org.name}" organization`, 'success');
        void router.visitOrganization({ organizationId: org.cleanId });
      }
    }
  }, [mutate, code, router, notify]);

  const goBack = useCallback(() => {
    void router.visitHome();
  }, [router]);

  return (
    <>
      <Title title="Invitation" />
      <DataWrapper query={query}>
        {({ data }) => {
          if (data.organizationByInviteCode == null) {
            return null;
          }
          const invitation = data.organizationByInviteCode;

          return (
            <div className="flex size-full flex-row items-center justify-center">
              <div className="flex w-full flex-col text-center md:w-2/3">
                {invitation.__typename === 'OrganizationInvitationError' ? (
                  <>
                    <h1 className={classes.title}>Invitation Error</h1>
                    <p className={classes.description}>{invitation.message}</p>

                    <div className={classes.actions}>
                      <Button variant="secondary" size="large" onClick={goBack}>
                        Back to Hive
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <h1 className={classes.title}>Join "{invitation.name}" organization?</h1>
                    <p className={classes.description}>
                      You've been invited to join "{invitation.name}" organization on GraphQL Hive.
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
                      <Button size="large" danger disabled={mutation.fetching} onClick={goBack}>
                        Ignore
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        }}
      </DataWrapper>
    </>
  );
}

export default authenticated(JoinOrganizationPage);
