import React from 'react';
import 'twin.macro';
import { track } from '@/lib/mixpanel';
import { useQuery, useMutation } from 'urql';
import { Button, Checkbox, Table, Thead, Tbody, Tr, Th, Td, useDisclosure } from '@chakra-ui/react';
import { FaGoogle, FaGithub, FaKey } from 'react-icons/fa';
import { Page } from '@/components/common';
import { CopyValue } from '@/components/common/CopyValue';
import { OrganizationView } from '@/components/organization/View';
import { MemberPermisssonsModal } from '@/components/organization/members/PermissionsModal';
import {
  OrganizationFieldsFragment,
  OrganizationMembersDocument,
  ResetInviteCodeDocument,
  OrganizationMembersQuery,
  DeleteOrganizationMembersDocument,
  MemberFieldsFragment,
  AuthProvider,
} from '@/graphql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { DataWrapper } from '@/components/common/DataWrapper';

const Invitation: React.FC<{
  organization: OrganizationMembersQuery['organization']['organization'];
}> = ({ organization }) => {
  const inviteUrl = `${window.location.origin}/join/${organization.inviteCode}`;
  const router = useRouteSelector();
  const notify = useNotifications();
  const [mutation, mutate] = useMutation(ResetInviteCodeDocument);

  const generate = React.useCallback(() => {
    track('GENERATE_NEW_INVITATION_LINK_ATTEMPT', {
      organization: router.organizationId,
    });
    mutate({
      selector: {
        organization: router.organizationId,
      },
    }).finally(() => {
      notify('Generated new invitation link', 'info');
    });
  }, [mutate, notify]);

  return (
    <div tw="flex flex-row space-x-3 pb-3">
      <CopyValue value={inviteUrl} />
      <Button type="button" onClick={generate} disabled={mutation.fetching}>
        Reset
      </Button>
    </div>
  );
};

const MemberRow: React.FC<{
  member: MemberFieldsFragment;
  owner: MemberFieldsFragment;
  organization: OrganizationFieldsFragment;
  checked: string[];
  onCheck(id: string): void;
}> = ({ member, owner, checked, onCheck, organization }) => {
  const isOwner = member.id === owner.id;
  const isMe = member.id === organization.me.id;
  const { isOpen, onOpen, onClose } = useDisclosure();

  const canManage = !isOwner && !isMe;

  const provider = member.user.provider;
  const providerIcon =
    provider === AuthProvider.Google ? (
      <FaGoogle color="#34a853" />
    ) : provider === AuthProvider.Github ? (
      <FaGithub color="#333" />
    ) : (
      <FaKey color="#fbbc05" />
    );

  return (
    <>
      <MemberPermisssonsModal isOpen={isOpen} onClose={onClose} member={member} organization={organization} />
      <Tr>
        <Td>
          <Checkbox
            colorScheme="primary"
            isDisabled={!canManage}
            checked={checked.includes(member.id)}
            onChange={() => onCheck(member.id)}
          />
        </Td>
        <Td textAlign="center">{providerIcon}</Td>
        <Td>{member.user.displayName}</Td>
        <Td>{member.user.email}</Td>
        <Td textAlign="right">
          {canManage && (
            <Button size="sm" variant="ghost" onClick={onOpen}>
              Change permissions
            </Button>
          )}
        </Td>
      </Tr>
    </>
  );
};

const MembersManager: React.FC<{
  organization: OrganizationFieldsFragment;
}> = ({ organization }) => {
  const [query] = useQuery({
    query: OrganizationMembersDocument,
    variables: {
      selector: {
        organization: organization.cleanId,
      },
    },
  });
  const [checked, setChecked] = React.useState<string[]>([]);
  const onCheck = React.useCallback(
    (id: string) => {
      if (checked.includes(id)) {
        setChecked(checked.filter(i => i !== id));
      } else {
        setChecked(checked.concat(id));
      }
    },
    [checked, setChecked]
  );
  const [mutation, mutate] = useMutation(DeleteOrganizationMembersDocument);
  const deleteMembers = React.useCallback(() => {
    mutate({
      selector: {
        organization: organization.cleanId,
        users: checked,
      },
    }).finally(() => {
      setChecked([]);
    });
  }, [mutate, checked, setChecked]);

  return (
    <DataWrapper query={query}>
      {() => (
        <div>
          <div tw="flex flex-row justify-between pb-3">
            <Invitation organization={query.data.organization.organization} />
            <div>
              <Button
                disabled={!checked.length || mutation.fetching}
                onClick={deleteMembers}
                type="button"
                colorScheme="red"
              >
                Delete
              </Button>
            </div>
          </div>
          <Table>
            <Thead>
              <Tr>
                <Th tw="w-10"></Th>
                <Th tw="w-10"></Th>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th textAlign="right">Permissions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {query.data.organization.organization?.members.nodes.map(member => (
                <MemberRow
                  key={member.id}
                  member={member}
                  organization={query.data.organization.organization}
                  owner={query.data.organization.organization.owner}
                  checked={checked}
                  onCheck={onCheck}
                />
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </DataWrapper>
  );
};

const Inner: React.FC<{ organization: OrganizationFieldsFragment }> = ({ organization }) => {
  const canAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Members,
    member: organization?.me,
    redirect: true,
  });

  if (!canAccess) {
    return null;
  }

  return (
    <Page title="Members" subtitle="Invite others to your organization and manage access.">
      <MembersManager organization={organization} />
    </Page>
  );
};

export default function OrganizationSettingsPage() {
  return (
    <OrganizationView title="Members">{({ organization }) => <Inner organization={organization} />}</OrganizationView>
  );
}
