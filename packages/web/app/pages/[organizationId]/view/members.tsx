import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { authenticated } from '@/components/authenticated-container';
import { OrganizationLayout, Page } from '@/components/layouts/organization';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { Avatar, Card, DocsLink, Heading, Input, MetaTitle } from '@/components/v2';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/v2/dropdown';
import { CopyIcon, KeyIcon, MoreIcon, SettingsIcon, TrashIcon } from '@/components/v2/icon';
import { ChangePermissionsModal, DeleteMembersModal } from '@/components/v2/modals';
import { FragmentType, graphql, useFragment } from '@/gql';
import { OrganizationFieldsFragment } from '@/graphql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { useClipboard } from '@/lib/hooks/use-clipboard';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { useToggle } from '@/lib/hooks/use-toggle';
import { withSessionProtection } from '@/lib/supertokens/guard';

export const DateFormatter = Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const Members_Invitation = graphql(`
  fragment Members_Invitation on OrganizationInvitation {
    id
    createdAt
    expiresAt
    email
    code
  }
`);

const MemberInvitationForm_InviteByEmail = graphql(`
  mutation MemberInvitationForm_InviteByEmail($input: InviteToOrganizationByEmailInput!) {
    inviteToOrganizationByEmail(input: $input) {
      ok {
        ...Members_Invitation
        email
        id
      }
      error {
        message
        inputErrors {
          email
        }
      }
    }
  }
`);

const InvitationDeleteButton_DeleteInvitation = graphql(`
  mutation InvitationDeleteButton_DeleteInvitation($input: DeleteOrganizationInvitationInput!) {
    deleteOrganizationInvitation(input: $input) {
      ok {
        ...Members_Invitation
      }
      error {
        message
      }
    }
  }
`);

const MemberInvitationForm = ({
  organizationCleanId,
}: {
  organizationCleanId: OrganizationFieldsFragment['cleanId'];
}) => {
  const notify = useNotifications();
  const [invitation, invite] = useMutation(MemberInvitationForm_InviteByEmail);
  const {
    handleSubmit,
    values,
    handleChange,
    handleBlur,
    isSubmitting,
    errors,
    touched,
    isValid,
    dirty,
    resetForm,
  } = useFormik({
    initialValues: { email: '' },
    validationSchema: Yup.object().shape({
      email: Yup.string().email().required('email is required'),
    }),
    async onSubmit(values) {
      const result = await invite({
        input: {
          organization: organizationCleanId,
          email: values.email,
        },
      });

      if (result.data?.inviteToOrganizationByEmail?.ok?.email) {
        notify(`Invited ${result.data.inviteToOrganizationByEmail.ok.email}`, 'success');
        globalThis.window?.location.reload();
      }
    },
  });

  const errorMessage =
    touched.email && (errors.email || invitation.error)
      ? errors.email || invitation.error?.message
      : invitation.data?.inviteToOrganizationByEmail.error?.inputErrors.email || null;

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-row items-center gap-2">
        <Input
          style={{
            minWidth: '200px',
          }}
          placeholder="Email"
          name="email"
          type="email"
          value={values.email}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={isSubmitting}
          isInvalid={touched.email && !!errors.email}
          onClear={resetForm}
        />
        <Button type="submit" disabled={isSubmitting || !isValid || !dirty}>
          Send an invite
        </Button>
      </form>
      {errorMessage && <div className="mt-2 text-sm text-red-500">{errorMessage}</div>}
    </div>
  );
};

function InvitationDeleteButton({
  email,
  organizationCleanId,
}: {
  email: string;
  organizationCleanId: string;
}) {
  const [mutation, mutate] = useMutation(InvitationDeleteButton_DeleteInvitation);

  return (
    <DropdownMenuItem
      disabled={mutation.fetching}
      onClick={async () => {
        await mutate({
          input: {
            organization: organizationCleanId,
            email,
          },
        });
        globalThis.window?.location.reload();
      }}
    >
      <TrashIcon /> Remove
    </DropdownMenuItem>
  );
}

const Invitation = (props: {
  invitation: FragmentType<typeof Members_Invitation>;
  organizationCleanId: string;
}): ReactElement => {
  const invitation = useFragment(Members_Invitation, props.invitation);
  const copyToClipboard = useClipboard();
  const copyLink = useCallback(async () => {
    await copyToClipboard(`${window.location.origin}/join/${invitation.code}`);
  }, [invitation.code, copyToClipboard]);

  return (
    <Card className="flex items-center gap-2.5 bg-gray-800/40">
      <div className="grow overflow-hidden">
        <h3 className="line-clamp-1 font-medium">{invitation.email}</h3>
        <h4 className="text-sm font-light text-gray-500">
          Invitation expires on {DateFormatter.format(new Date(invitation.expiresAt))}
        </h4>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">
            <MoreIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent sideOffset={5} align="start">
          <DropdownMenuItem onClick={copyLink}>
            <CopyIcon />
            Copy invite link
          </DropdownMenuItem>
          <InvitationDeleteButton
            organizationCleanId={props.organizationCleanId}
            email={invitation.email}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
};

const Page_OrganizationFragment = graphql(`
  fragment Page_OrganizationFragment on Organization {
    me {
      id
      ...CanAccessOrganization_MemberFragment
      ...ChangePermissionsModal_MemberFragment
    }
    cleanId
    owner {
      id
    }
    members {
      nodes {
        id
        ...ChangePermissionsModal_MemberFragment
        user {
          id
          provider
          displayName
          email
        }
      }
      total
    }
    ...OrganizationInvitations_OrganizationFragment
    ...ChangePermissionsModal_OrganizationFragment
  }
`);

const OrganizationInvitations_OrganizationFragment = graphql(`
  fragment OrganizationInvitations_OrganizationFragment on Organization {
    id
    cleanId
    invitations {
      nodes {
        id
        ...Members_Invitation
      }
    }
  }
`);

const OrganizationMembersPage_MeFragment = graphql(`
  fragment OrganizationMembersPage_MeFragment on User {
    id
    fullName
    displayName
  }
`);

const OrganizationInvitations = (props: {
  organization: FragmentType<typeof OrganizationInvitations_OrganizationFragment>;
}): ReactElement | null => {
  const org = useFragment(OrganizationInvitations_OrganizationFragment, props.organization);

  return org.invitations.nodes.length ? (
    <div className="pt-3">
      <Heading className="mb-2">Pending Invitations</Heading>
      {org.invitations.nodes.map(node => (
        <Invitation key={node.id} invitation={node} organizationCleanId={org.cleanId} />
      ))}
    </div>
  ) : null;
};

function PageContent(props: {
  organization: FragmentType<typeof Page_OrganizationFragment>;
  me?: FragmentType<typeof OrganizationMembersPage_MeFragment>;
}) {
  const organization = useFragment(Page_OrganizationFragment, props.organization);

  useOrganizationAccess({
    scope: OrganizationAccessScope.Members,
    redirect: true,
    member: organization.me,
  });

  const [checked, setChecked] = useState<string[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [isPermissionsModalOpen, togglePermissionsModalOpen] = useToggle();
  const [isDeleteMembersModalOpen, toggleDeleteMembersModalOpen] = useToggle();

  const router = useRouteSelector();
  const members = organization?.members.nodes;

  useEffect(() => {
    if (members) {
      // uncheck checkboxes when members were deleted
      setChecked(prev => prev.filter(id => members.some(node => node.id === id)));
    }
  }, [router, members]);

  if (!organization) {
    return null;
  }

  const me = useFragment(OrganizationMembersPage_MeFragment, props.me);
  const selectedMember = selectedMemberId
    ? members?.find(node => node.id === selectedMemberId)
    : null;

  return (
    <div className="flex flex-col gap-y-4">
      <div className="py-6">
        <Title>Members</Title>
        <Subtitle>
          You may invite other members to collaborate with you on this organization.
        </Subtitle>
        <p>
          <DocsLink href="/management/organizations#members" className="text-muted-foreground">
            Learn more about membership and invitations
          </DocsLink>
        </p>
      </div>
      {selectedMember && (
        <ChangePermissionsModal
          isOpen={isPermissionsModalOpen}
          toggleModalOpen={togglePermissionsModalOpen}
          organization={organization}
          member={selectedMember}
        />
      )}
      <DeleteMembersModal
        isOpen={isDeleteMembersModalOpen}
        toggleModalOpen={toggleDeleteMembersModalOpen}
        memberIds={checked}
      />
      <div className="flex items-center justify-between">
        <MemberInvitationForm organizationCleanId={organization.cleanId} />
        <Button
          variant="destructive"
          className="flex flex-row items-center justify-between"
          onClick={toggleDeleteMembersModalOpen}
          disabled={checked.length === 0}
        >
          Delete {checked.length || ''}
          <TrashIcon className="ml-2 h-4 w-4" />
        </Button>
      </div>
      {members?.map(node => {
        const IconToUse = KeyIcon;

        const isOwner = node.id === organization.owner.id;
        const isMe = node.id === me?.id;
        const isDisabled = isOwner || isMe;

        return (
          <Card key={node.id} className="flex items-center gap-2.5 bg-gray-800/40">
            <Checkbox
              onCheckedChange={isChecked =>
                setChecked(isChecked ? [...checked, node.id] : checked.filter(k => k !== node.id))
              }
              checked={checked.includes(node.id)}
              disabled={isDisabled}
            />
            <Avatar fallback="P" shape="circle" />
            <div className="grow overflow-hidden">
              <h3 className="line-clamp-1 font-medium">{node.user.displayName}</h3>
              <h4 className="text-sm font-light text-gray-500">{node.user.email}</h4>
            </div>
            <div className="rounded-full bg-gray-800 p-2" title={node.user.provider}>
              <IconToUse className="h-5 w-5" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={isDisabled ? 'invisible' : ''}>
                  <MoreIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent sideOffset={5} align="start">
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedMemberId(node.id);
                    togglePermissionsModalOpen();
                  }}
                >
                  <SettingsIcon />
                  Change permissions
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setChecked([node.id]);
                    toggleDeleteMembersModalOpen();
                  }}
                >
                  <TrashIcon /> Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Card>
        );
      })}
      <OrganizationInvitations organization={organization} />
    </div>
  );
}

const OrganizationMembersPageQuery = graphql(`
  query OrganizationMembersPageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        ...OrganizationLayout_CurrentOrganizationFragment
        ...Page_OrganizationFragment
      }
    }
    organizations {
      ...OrganizationLayout_OrganizationConnectionFragment
    }
    me {
      id
      ...OrganizationLayout_MeFragment
      ...OrganizationMembersPage_MeFragment
    }
  }
`);

function SettingsPageContent() {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: OrganizationMembersPageQuery,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const organizationConnection = query.data?.organizations;

  return (
    <OrganizationLayout
      page={Page.Members}
      className="flex flex-col gap-y-10"
      currentOrganization={currentOrganization ?? null}
      organizations={organizationConnection ?? null}
      me={me ?? null}
    >
      {currentOrganization ? <PageContent organization={currentOrganization} me={me} /> : null}
    </OrganizationLayout>
  );
}

function OrganizationMembersPage(): ReactElement {
  return (
    <>
      <MetaTitle title="Members" />
      <SettingsPageContent />
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(OrganizationMembersPage);
