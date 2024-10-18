import { useCallback } from 'react';
import { LogOutIcon } from 'lucide-react';
import { useMutation, useQuery } from 'urql';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DottedBackground } from '@/components/ui/dotted-background';
import { HiveLogo } from '@/components/ui/icon';
import { Meta } from '@/components/ui/meta';
import { useToast } from '@/components/ui/use-toast';
import { DataWrapper } from '@/components/v2/data-wrapper';
import { graphql } from '@/gql';
import { Link, useRouter } from '@tanstack/react-router';

const JoinOrganizationPage_JoinOrganizationMutation = graphql(`
  mutation JoinOrganizationPage_JoinOrganizationMutation($code: String!) {
    joinOrganization(code: $code) {
      __typename
      ... on OrganizationPayload {
        selector {
          organizationSlug
        }
        organization {
          id
          slug
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

export function JoinOrganizationPage(props: { inviteCode: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const code = props.inviteCode;
  const [query] = useQuery({
    query: JoinOrganizationPage_OrganizationInvitationQuery,
    variables: { code },
  });
  const [mutation, mutate] = useMutation(JoinOrganizationPage_JoinOrganizationMutation);
  const accept = useCallback(async () => {
    const result = await mutate({ code });
    if (result.data) {
      if (result.data.joinOrganization.__typename === 'OrganizationInvitationError') {
        toast({
          title: 'Failed to join organization',
          description: result.data.joinOrganization.message,
          variant: 'destructive',
        });
      } else {
        const org = result.data.joinOrganization.organization;
        toast({
          title: 'Joined organization',
          description: `You are now a member of ${org.slug}`,
        });
        void router.navigate({
          to: '/$organizationSlug',
          params: { organizationSlug: org.slug },
        });
      }
    }
  }, [mutate, code, router, toast]);

  const goBack = useCallback(() => {
    void router.navigate({
      to: '/',
    });
  }, [router]);

  const orgName =
    query.data?.organizationByInviteCode?.__typename === 'OrganizationInvitationPayload'
      ? query.data.organizationByInviteCode.name
      : null;

  return (
    <>
      <Meta title={orgName ? `Invitation to ${orgName}` : 'Invitation'} />
      <DottedBackground className="min-h-[100vh]">
        <Button
          variant="outline"
          onClick={() => router.navigate({ to: '/logout' })}
          className="absolute right-6 top-6"
        >
          <LogOutIcon className="mr-2 size-4" /> Sign out
        </Button>
        <Link href="/" className="absolute left-6 top-6">
          <HiveLogo className="size-10" />
        </Link>
        <div className="container md:w-3/5 lg:w-1/2">
          <DataWrapper query={query} organizationSlug={null}>
            {({ data }) => {
              if (data.organizationByInviteCode == null) {
                return null;
              }
              const invitation = data.organizationByInviteCode;

              if (invitation.__typename === 'OrganizationInvitationError') {
                return (
                  <div className="bg-black">
                    <Card>
                      <CardHeader>
                        <CardTitle>Invitation Error</CardTitle>
                      </CardHeader>
                      <CardContent>{invitation.message}</CardContent>
                      <CardFooter>
                        <Button className="w-full" onClick={goBack}>
                          Back to Hive
                        </Button>
                      </CardFooter>
                    </Card>
                  </div>
                );
              }

              return (
                <div className="bg-black">
                  <Card>
                    <CardHeader>
                      <CardTitle>Join "{invitation.name}" organization</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>
                        You've been invited to become a member of{' '}
                        <span className="font-semibold">{invitation.name}</span>.
                      </p>
                      <p className="text-muted-foreground mt-2">
                        By accepting the invitation, you will be able to collaborate with other
                        members of this organization.
                      </p>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-y-4 md:flex-row md:justify-evenly md:gap-x-4 md:gap-y-0">
                      <Button
                        className="w-full md:flex-1"
                        variant="outline"
                        disabled={mutation.fetching}
                        onClick={goBack}
                      >
                        Ignore
                      </Button>
                      <Button
                        className="w-full md:flex-1"
                        onClick={accept}
                        disabled={mutation.fetching}
                      >
                        Accept
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              );
            }}
          </DataWrapper>
        </div>
      </DottedBackground>
    </>
  );
}
