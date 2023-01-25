import * as React from 'react';
import tw from 'twin.macro';
import { gql, useMutation, useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Title } from '@/components/common';
import { DataWrapper } from '@/components/common/DataWrapper';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { Button } from '@chakra-ui/react';

const Center = tw.div`w-full h-full flex flex-row items-center justify-center`;

const Invitation = {
  Root: tw.div`flex flex-col text-center md:w-2/3 w-full`,
  Title: tw.h1`sm:text-4xl text-3xl mb-4 font-medium text-white`,
  Description: tw.p`mb-8 leading-relaxed`,
  Actions: tw.div`flex flex-row gap-2 items-center justify-center`,
};

const OrganizationTransferPage_GetRequest = gql(`
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

const OrganizationTransferPage_AnswerRequest = gql(`
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
  const orgId = router.query.orgId as string;
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
  const answer = React.useCallback(
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
          router.visitOrganization({
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

  const accept = React.useCallback(() => answer(true), [answer]);
  const reject = React.useCallback(() => answer(false), [answer]);

  const goBack = React.useCallback(() => {
    router.visitHome();
  }, [router]);

  return (
    <>
      <Title title="Organization Transfer" />
      <DataWrapper query={query}>
        {({ data }) => {
          if (data.organizationTransferRequest == null) {
            return (
              <Center>
                <Invitation.Root>
                  <Invitation.Title>Organization Transfer Error</Invitation.Title>
                  <Invitation.Description>Not found</Invitation.Description>

                  <Invitation.Actions>
                    <Button onClick={goBack}>Back to Hive</Button>
                  </Invitation.Actions>
                </Invitation.Root>
              </Center>
            );
          }

          return (
            <Center>
              <Invitation.Root>
                <Invitation.Title>Accept the transfer?</Invitation.Title>
                <Invitation.Description>
                  {data.organizationTransferRequest.organization.owner.user.displayName} wants to
                  transfer the "{data.organizationTransferRequest.organization.name}" organization
                  to you.
                </Invitation.Description>

                <Invitation.Actions>
                  <Button colorScheme="primary" onClick={accept} disabled={mutation.fetching}>
                    Accept
                  </Button>
                  <Button colorScheme="red" onClick={reject} disabled={mutation.fetching}>
                    Reject
                  </Button>
                </Invitation.Actions>
              </Invitation.Root>
            </Center>
          );
        }}
      </DataWrapper>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(OrganizationTransferPage);
