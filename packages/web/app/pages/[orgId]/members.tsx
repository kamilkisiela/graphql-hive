import { ReactElement, useCallback, useEffect, useState } from 'react';
import { Tooltip } from '@chakra-ui/react';
import { useFormik } from 'formik';
import { DocumentType, gql, useMutation, useQuery } from 'urql';
import * as Yup from 'yup';

import { authenticated } from '@/components/authenticated-container';
import { OrganizationLayout } from '@/components/layouts';
import { Avatar, Button, Card, Checkbox, DropdownMenu, Input, Title } from '@/components/v2';
import { CopyIcon, KeyIcon, MoreIcon, SettingsIcon, TrashIcon } from '@/components/v2/icon';
import { ChangePermissionsModal, DeleteMembersModal } from '@/components/v2/modals';
import { MeDocument, OrganizationFieldsFragment, OrganizationType } from '@/graphql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { useClipboard } from '@/lib/hooks/use-clipboard';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { useToggle } from '@/lib/hooks/use-toggle';

export const DateFormatter = Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const Members_Invitation = gql(/* GraphQL */ `
  fragment Members_Invitation on OrganizationInvitation {
    id
    createdAt
    expiresAt
    email
    code
  }
`);

export const MemberInvitationForm_InviteByEmail = gql(/* GraphQL */ `
  mutation MemberInvitationForm_InviteByEmail($input: InviteToOrganizationByEmailInput!) {
    inviteToOrganizationByEmail(input: $input) {
      ok {
        ...Members_Invitation
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

export const InvitationDeleteButton_DeleteInvitation = gql(/* GraphQL */ `
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
  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched, isValid, dirty, resetForm } =
    useFormik({
      initialValues: { email: '' },
      validationSchema: Yup.object().shape({
        email: Yup.string().email().required('Email is required'),
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
          resetForm();
        }
      },
    });

  const errorMessage =
    touched.email && (errors.email || invitation.error)
      ? errors.email || invitation.error?.message
      : invitation.data?.inviteToOrganizationByEmail.error?.inputErrors.email
      ? invitation.data.inviteToOrganizationByEmail.error.inputErrors.email
      : null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-row gap-2">
      <Tooltip hasArrow placement="top" label={errorMessage} isOpen={typeof errorMessage === 'string'} bg="red.600">
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
          isInvalid={touched.email && Boolean(errors.email)}
        />
      </Tooltip>
      <Button type="submit" size="large" block variant="primary" disabled={isSubmitting || !isValid || !dirty}>
        Send an invite
      </Button>
    </form>
  );
};

const InvitationDeleteButton = ({ email, organizationCleanId }: { email: string; organizationCleanId: string }) => {
  const [mutation, mutate] = useMutation(InvitationDeleteButton_DeleteInvitation);

  return (
    <DropdownMenu.Item
      disabled={mutation.fetching}
      onClick={() => {
        mutate({
          input: {
            organization: organizationCleanId,
            email,
          },
        });
      }}
    >
      <TrashIcon /> Remove
    </DropdownMenu.Item>
  );
};

export const Members_OrganizationMembers = gql(/* GraphQL */ `
  query Members_OrganizationMembers($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        ...OrganizationFields
        owner {
          ...MemberFields
        }
        members {
          nodes {
            ...MemberFields
          }
          total
        }
        invitations {
          nodes {
            ...Members_Invitation
          }
        }
      }
    }
  }
`);

const Invitation = ({
  invitation,
  organizationCleanId,
}: {
  invitation: DocumentType<typeof Members_Invitation>;
  organizationCleanId: string;
}) => {
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
        <DropdownMenu.Trigger asChild>
          <Button rotate={90}>
            <MoreIcon />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content sideOffset={5} align="start">
          <DropdownMenu.Item onClick={copyLink}>
            <CopyIcon />
            Copy invite link
          </DropdownMenu.Item>
          <InvitationDeleteButton organizationCleanId={organizationCleanId} email={invitation.email} />
        </DropdownMenu.Content>
      </DropdownMenu>
    </Card>
  );
};

const Page = ({ organization }: { organization: OrganizationFieldsFragment }) => {
  useOrganizationAccess({
    scope: OrganizationAccessScope.Members,
    redirect: true,
    member: organization.me,
  });

  const [checked, setChecked] = useState<string[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [isPermissionsModalOpen, togglePermissionsModalOpen] = useToggle(false);
  const [isDeleteMembersModalOpen, toggleDeleteMembersModalOpen] = useToggle(false);

  const [meQuery] = useQuery({ query: MeDocument });
  const router = useRouteSelector();
  const [organizationMembersQuery] = useQuery({
    query: Members_OrganizationMembers,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });

  const org = organizationMembersQuery.data?.organization?.organization;
  const isPersonal = org?.type === OrganizationType.Personal;
  const members = org?.members.nodes;
  const invitations = org?.invitations.nodes;

  useEffect(() => {
    if (isPersonal) {
      router.replace(`/${router.organizationId}`);
    } else if (members) {
      // uncheck checkboxes when members were deleted
      setChecked(prev => prev.filter(id => members.some(node => node.id === id)));
    }
  }, [isPersonal, router, members]);

  if (!org || isPersonal) return null;

  const me = meQuery.data?.me;
  const selectedMember = selectedMemberId ? members?.find(node => node.id === selectedMemberId) : null;

  return (
    <>
      <p className="mb-3 font-light text-gray-300">Invite others to your organization and manage access</p>
      {selectedMember && (
        <ChangePermissionsModal
          isOpen={isPermissionsModalOpen}
          toggleModalOpen={togglePermissionsModalOpen}
          organization={org}
          member={selectedMember}
        />
      )}
      <DeleteMembersModal
        isOpen={isDeleteMembersModalOpen}
        toggleModalOpen={toggleDeleteMembersModalOpen}
        memberIds={checked}
      />
      <div className="flex items-center justify-between">
        <MemberInvitationForm organizationCleanId={org.cleanId} />
        <Button
          size="large"
          danger
          className="min-w-[150px] justify-between"
          onClick={toggleDeleteMembersModalOpen}
          disabled={checked.length === 0}
        >
          Delete {checked.length || ''}
          <TrashIcon />
        </Button>
      </div>
      {members?.map(node => {
        const IconToUse = KeyIcon;

        const isOwner = node.id === org.owner.id;
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
              <DropdownMenu.Trigger asChild>
                <Button rotate={90} className={isDisabled ? 'invisible' : ''}>
                  <MoreIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content sideOffset={5} align="start">
                <DropdownMenu.Item
                  onClick={() => {
                    setSelectedMemberId(node.id);
                    togglePermissionsModalOpen();
                  }}
                >
                  <SettingsIcon />
                  Change permissions
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => {
                    setChecked([node.id]);
                    toggleDeleteMembersModalOpen();
                  }}
                >
                  <TrashIcon /> Remove
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </Card>
        );
      })}
      {invitations?.length ? (
        <div className="pt-3">
          <div className="border-t-4 border-solid pb-6"></div>
          {invitations.map(node => (
            <Invitation key={node.id} invitation={node} organizationCleanId={org.cleanId} />
          ))}
        </div>
      ) : null}
    </>
  );
};

function MembersPage(): ReactElement {
  return (
    <>
      <Title title="Members" />
      <OrganizationLayout value="members" className="flex w-4/5 flex-col gap-4">
        {({ organization }) => <Page organization={organization} />}
      </OrganizationLayout>
    </>
  );
}

export default authenticated(MembersPage);
