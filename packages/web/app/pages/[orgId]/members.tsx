import { ReactElement, useCallback, useEffect, useState } from 'react';
import { IconProps } from '@chakra-ui/react';
import { useMutation, useQuery } from 'urql';

import { useUser } from '@/components/auth/AuthProvider';
import { OrganizationLayout } from '@/components/layouts';
import { Avatar, Button, Card, Checkbox, CopyValue, DropdownMenu, Title } from '@/components/v2';
import { GitHubIcon, GoogleIcon, KeyIcon, MoreIcon, SettingsIcon, TrashIcon } from '@/components/v2/icon';
import { ChangePermissionsModal, DeleteMembersModal } from '@/components/v2/modals';
import {
  AuthProvider,
  MeDocument,
  OrganizationFieldsFragment,
  OrganizationMembersDocument,
  OrganizationType,
  ResetInviteCodeDocument,
} from '@/graphql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const authProviderIcons = {
  [AuthProvider.Github]: GitHubIcon,
  [AuthProvider.Google]: GoogleIcon,
} as Record<AuthProvider, React.FC<IconProps> | undefined>;

const Page = ({ organization }: { organization: OrganizationFieldsFragment }) => {
  useOrganizationAccess({
    scope: OrganizationAccessScope.Members,
    redirect: true,
    member: organization.me,
  });

  const [checked, setChecked] = useState<string[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [isModalOpen, setModalOpen] = useState(false);
  const toggleModalOpen = useCallback(() => {
    setModalOpen(prevOpen => !prevOpen);
  }, []);

  const [isDeleteMembersModalOpen, setDeleteMembersModalOpen] = useState(false);
  const toggleDeleteMembersModalOpen = useCallback(() => {
    setDeleteMembersModalOpen(prevOpen => !prevOpen);
  }, []);

  const { user } = useUser();
  const [meQuery] = useQuery({ query: MeDocument });
  const router = useRouteSelector();
  const notify = useNotifications();
  const [organizationMembersQuery] = useQuery({
    query: OrganizationMembersDocument,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });

  const [, mutate] = useMutation(ResetInviteCodeDocument);

  const handleReset = useCallback(() => {
    mutate({
      selector: {
        organization: router.organizationId,
      },
    }).finally(() => {
      notify('Generated new invitation link', 'info');
    });
  }, [mutate, notify, router.organizationId]);

  const org = organizationMembersQuery.data?.organization?.organization;
  const isPersonal = org?.type === OrganizationType.Personal;
  const members = org?.members.nodes;

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
          isOpen={isModalOpen}
          toggleModalOpen={toggleModalOpen}
          organization={org}
          member={selectedMember}
        />
      )}
      <DeleteMembersModal
        isOpen={isDeleteMembersModalOpen}
        toggleModalOpen={toggleDeleteMembersModalOpen}
        memberIds={checked}
      />
      <div className="flex gap-4">
        <CopyValue className="grow" value={`${window.location.origin}/join/${org.inviteCode}`} />
        <Button
          variant="secondary"
          size="large"
          className="px-5"
          onClick={handleReset}
          title="Generate new invitation link"
        >
          Reset
        </Button>
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
        const IconToUse = authProviderIcons[node.user.provider] ?? KeyIcon;

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
            <Avatar src={isMe ? user?.picture : ''} fallback={node.user.displayName[0]} shape="circle" />
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
                    toggleModalOpen();
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
    </>
  );
};

export default function MembersPage(): ReactElement {
  return (
    <>
      <Title title="Members" />
      <OrganizationLayout value="members" className="flex w-4/5 flex-col gap-4">
        {({ organization }) => <Page organization={organization} />}
      </OrganizationLayout>
    </>
  );
}
