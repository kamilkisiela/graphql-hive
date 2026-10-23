import { useCallback, useEffect } from 'react';
import { LogOutIcon } from 'lucide-react';
import { useMutation, useQuery } from 'urql';
import { HiveLogo } from '@/components/ui/brand-icon';
import { DataWrapper } from '@/components/ui/data-wrapper';
import { DottedBackground } from '@/components/ui/dotted-background';
import { Meta } from '@/components/ui/meta';
import { Button } from '@/components/ui/primitives/button/button';
import { Card } from '@/components/ui/primitives/card/card';
import { Spinner } from '@/components/ui/primitives/spinner/spinner';
import { useToast } from '@/components/ui/primitives/toast/toast';
import { graphql } from '@/gql';
import { useSession } from '@/lib/auth/use-session';
import { HiveStripeWrapper } from '@/lib/billing/stripe';
import { Link, useRouter } from '@tanstack/react-router';

export const JoinOrganizationPage_JoinOrganizationMutation = graphql(`
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
  const session = useSession();
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

  useEffect(() => {
    if (!session.loading && !session.doesSessionExist) {
      toast({
        title: 'Account Required',
        description:
          'To accept an organization invite, you must first have an account, log in, and then use the invitation.',
        variant: 'default',
        duration: 10_000,
      });
      void router.navigate({
        to: '/auth/sign-in',
        search: {
          redirectToPath: router.latestLocation.pathname,
        },
      });
    }
  }, [!session.loading && !session.doesSessionExist, toast, router]);

  if (session.loading) {
    return (
      <div className="mt-6 flex justify-center">
        <Spinner />
      </div>
    );
  }

  if (!session.doesSessionExist) {
    return <></>;
  }

  return (
    <HiveStripeWrapper>
      <Meta title={orgName ? `Invitation to ${orgName}` : 'Invitation'} />
      <DottedBackground className="min-h-[100vh]">
        <div className="absolute top-6 right-6">
          <Button variant="outline" onClick={() => router.navigate({ to: '/logout' })}>
            <LogOutIcon className="mr-2 size-4" /> Sign out
          </Button>
        </div>
        <Link to="/" className="absolute top-6 left-6">
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
                  <div className="bg-surface-inset">
                    <Card
                      variants={{ onSurface: 'raised', titleSize: 'large' }}
                      title="Invitation Error"
                    >
                      {invitation.message}
                      <div className="mt-6 flex items-center">
                        <Button width="full" onSurface="raised" onClick={goBack}>
                          Back to Hive
                        </Button>
                      </div>
                    </Card>
                  </div>
                );
              }

              return (
                <div className="bg-surface-inset">
                  <Card
                    variants={{ onSurface: 'raised', titleSize: 'large' }}
                    title={`Join "${invitation.name}" organization`}
                  >
                    <p>
                      You've been invited to become a member of{' '}
                      <span className="font-semibold">{invitation.name}</span>.
                    </p>
                    <p className="mt-2 text-fg-secondary">
                      By accepting the invitation, you will be able to collaborate with other
                      members of this organization.
                    </p>
                    <div className="mt-6 flex flex-col gap-y-4 md:flex-row md:justify-evenly md:gap-x-4 md:gap-y-0">
                      <Button
                        variant="outline"
                        width="full"
                        disabled={mutation.fetching}
                        onClick={goBack}
                      >
                        Ignore
                      </Button>
                      <Button
                        width="full"
                        onSurface="raised"
                        onClick={accept}
                        disabled={mutation.fetching}
                      >
                        Accept
                      </Button>
                    </div>
                  </Card>
                </div>
              );
            }}
          </DataWrapper>
        </div>
      </DottedBackground>
    </HiveStripeWrapper>
  );
}
