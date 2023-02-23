import { ReactElement, useCallback, useEffect, useState } from 'react';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { authenticated } from '@/components/authenticated-container';
import { OrganizationLayout } from '@/components/layouts';
import { Avatar, Button, Card, Checkbox, Input, Title } from '@/components/v2';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/v2/dropdown';
import { CopyIcon, KeyIcon, MoreIcon, SettingsIcon, TrashIcon } from '@/components/v2/icon';
import { ChangePermissionsModal, DeleteMembersModal } from '@/components/v2/modals';
import { FragmentType, graphql, useFragment } from '@/gql';
import { MeDocument, OrganizationFieldsFragment, OrganizationType } from '@/graphql';
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

export const MemberInvitationForm_InviteByEmail = graphql(`
  mutation MemberInvitationForm_InviteByEmail($input: InviteToOrganizationByEmailInput!) {
    inviteToOrganizationByEmail(input: $input) {
      ok {
        ...Members_Invitation
        email
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

export const InvitationDeleteButton_DeleteInvitation = graphql(`
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
        resetForm();
      }
    },
  });

  const errorMessage =
    touched.email && (errors.email || invitation.error)
      ? errors.email || invitation.error?.message
      : invitation.data?.inviteToOrganizationByEmail.error?.inputErrors.email || null;

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex flex-row gap-2">
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
        <Button
          type="submit"
          size="large"
          block
          variant="primary"
          disabled={isSubmitting || !isValid || !dirty}
        >
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
          <Button rotate={90}>
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
      ...CanAccessOrganization_MemberFragment
      ...ChangePermissionsModal_MemberFragment
    }
    cleanId
    type
    owner {
      id
    }
    members {
      nodes {
        id
        ...ChangePermissionsModal_MemberFragment
        user {
          provider
          displayName
          email
        }
      }
      total
    }
    invitations {
      nodes {
        id
        ...Members_Invitation
      }
    }
    ...ChangePermissionsModal_OrganizationFragment
  }
`);

function Page(props: { organization: FragmentType<typeof Page_OrganizationFragment> }) {
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

  const [meQuery] = useQuery({ query: MeDocument });
  const router = useRouteSelector();

  const org = organization;
  const isPersonal = org?.type === OrganizationType.Personal;
  const members = org?.members.nodes;
  const invitations = org?.invitations.nodes;

  useEffect(() => {
    if (isPersonal) {
      void router.replace(`/${router.organizationId}`);
    } else if (members) {
      // uncheck checkboxes when members were deleted
      setChecked(prev => prev.filter(id => members.some(node => node.id === id)));
    }
  }, [isPersonal, router, members]);

  if (!org || isPersonal) return null;

  const me = meQuery.data?.me;
  const selectedMember = selectedMemberId
    ? members?.find(node => node.id === selectedMemberId)
    : null;

  return (
    <>
      <p className="mb-3 font-light text-gray-300">
        Invite others to your organization and manage access
      </p>
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
              <DropdownMenuTrigger asChild>
                <Button rotate={90} className={isDisabled ? 'invisible' : ''}>
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
      {invitations?.length ? (
        <div className="pt-3">
          <div className="border-t-4 border-solid pb-6" />
          {invitations.map(node => (
            <Invitation key={node.id} invitation={node} organizationCleanId={org.cleanId} />
          ))}
        </div>
      ) : null}
    </>
  );
}

const OrganizationMembersPageQuery = graphql(`
  query OrganizationMembersPageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        ...OrganizationLayout_OrganizationFragment
        ...Page_OrganizationFragment
      }
    }
  }
`);

function OrganizationMembersPage(): ReactElement {
  return (
    <>
      <Title title="Members" />
      <OrganizationLayout
        value="members"
        className="flex w-4/5 flex-col gap-4"
        query={OrganizationMembersPageQuery}
      >
        {({ organization }) =>
          organization ? <Page organization={organization.organization} /> : null
        }
      </OrganizationLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(OrganizationMembersPage);
