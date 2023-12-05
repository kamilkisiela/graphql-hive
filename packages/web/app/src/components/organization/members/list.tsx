import { useCallback, useMemo, useState } from 'react';
import { MoreHorizontalIcon, MoveDownIcon, MoveUpIcon, SettingsIcon } from 'lucide-react';
import type { IconType } from 'react-icons';
import { FaGithub, FaGoogle, FaOpenid, FaUserLock } from 'react-icons/fa';
import { useMutation } from 'urql';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { CardDescription, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/components/ui/use-toast';
import { ChangePermissionsModal } from '@/components/v2/modals';
import { FragmentType, graphql, useFragment } from '@/gql';
import { AuthProvider } from '@/gql/graphql';
import { useToggle } from '@/lib/hooks';
import { RoleSelector } from './common';
import { MemberInvitationButton } from './invitations';

const OrganizationMemberRoleSwitcher_AssignRoleMutation = graphql(`
  mutation OrganizationMemberRoleSwitcher_AssignRoleMutation($input: AssignMemberRoleInput!) {
    assignMemberRole(input: $input) {
      ok {
        updatedMember {
          id
          user {
            id
            displayName
          }
          role {
            id
            # Updates the members count of the role
            membersCount
          }
        }
        previousMemberRole {
          id
          # Updates the members count of the role
          membersCount
        }
      }
      error {
        message
      }
    }
  }
`);

const OrganizationMemberRoleSwitcher_OrganizationFragment = graphql(`
  fragment OrganizationMemberRoleSwitcher_OrganizationFragment on Organization {
    id
    cleanId
    me {
      id
      isAdmin
      organizationAccessScopes
      projectAccessScopes
      targetAccessScopes
    }
    owner {
      id
    }
    memberRoles {
      id
      name
      description
      locked
      organizationAccessScopes
      projectAccessScopes
      targetAccessScopes
    }
    # This is used for the migration flow, to keep it synced
    # Remove this once we migrate all the users.
    unassignedMembersToMigrate {
      id
      ...OrganizationMemberRolesMigrationGroup_MemberRoleMigrationGroup
    }
    ...ChangePermissionsModal_OrganizationFragment
  }
`);

const OrganizationMemberRoleSwitcher_MemberFragment = graphql(`
  fragment OrganizationMemberRoleSwitcher_MemberFragment on Member {
    id
    organizationAccessScopes
    projectAccessScopes
    targetAccessScopes
    ...ChangePermissionsModal_MemberFragment
  }
`);

function OrganizationMemberRoleSwitcher(props: {
  organization: FragmentType<typeof OrganizationMemberRoleSwitcher_OrganizationFragment>;
  memberId: string;
  memberName: string;
  memberRoleId?: string;
  member?: FragmentType<typeof OrganizationMemberRoleSwitcher_MemberFragment>;
}) {
  const organization = useFragment(
    OrganizationMemberRoleSwitcher_OrganizationFragment,
    props.organization,
  );
  const member = useFragment(OrganizationMemberRoleSwitcher_MemberFragment, props.member);
  const { me } = organization;
  const isOwner = props.memberId === organization.owner.id;
  const isMe = props.memberId === me.id;
  // A user can't change its own role
  const canAssignRole = !isOwner && !isMe;
  const roles = organization.memberRoles;
  const { toast } = useToast();
  const [assignRoleState, assignRole] = useMutation(
    OrganizationMemberRoleSwitcher_AssignRoleMutation,
  );
  const [isPermissionsModalOpen, togglePermissionsModalOpen] = useToggle(false);
  const memberRole = roles.find(role => role.id === props.memberRoleId);

  if (!memberRole && !member) {
    console.error('No role or member provided to OrganizationMemberRoleSwitcher');
    return null;
  }

  const memberOrganizationAccessScopes = (memberRole ?? member)!.organizationAccessScopes;
  const memberProjectAccessScopes = (memberRole ?? member)!.projectAccessScopes;
  const memberTargetAccessScopes = (memberRole ?? member)!.targetAccessScopes;

  return (
    <>
      <RoleSelector
        roles={roles}
        onSelect={async role => {
          try {
            const result = await assignRole({
              input: {
                organization: organization.cleanId,
                role: role.id,
                member: props.memberId,
              },
            });

            if (result.error) {
              toast({
                variant: 'destructive',
                title: `Failed to assign role to ${props.memberName}`,
                description: result.error.message,
              });
            } else if (result.data?.assignMemberRole.error) {
              toast({
                variant: 'destructive',
                title: `Failed to assign role to ${props.memberName}`,
                description: result.data.assignMemberRole.error.message,
              });
            } else if (result.data?.assignMemberRole.ok) {
              toast({
                title: `Assigned ${role.name} to ${result.data.assignMemberRole.ok.updatedMember.user.displayName}`,
              });
            }
          } catch (error: any) {
            console.error(error);
            toast({
              variant: 'destructive',
              title: `Failed to assign role to ${props.memberName}`,
              description: 'message' in error ? error.message : String(error),
            });
          }
        }}
        defaultRole={memberRole}
        disabled={!canAssignRole || assignRoleState.fetching}
        isRoleActive={role => {
          const isCurrentRole = role.id === props.memberRoleId;
          const canDowngrade = me.isAdmin;
          const hasAccessToScopesOfRole =
            role.organizationAccessScopes.every(scope =>
              me.organizationAccessScopes.includes(scope),
            ) &&
            role.projectAccessScopes.every(scope => me.projectAccessScopes.includes(scope)) &&
            role.targetAccessScopes.every(scope => me.targetAccessScopes.includes(scope));
          // If the new role has more or equal access scopes than the current role, we can assign it
          const newRoleHasMoreOrEqualAccess =
            // organization
            role.organizationAccessScopes.length >= memberOrganizationAccessScopes.length &&
            role.organizationAccessScopes.every(scope =>
              memberOrganizationAccessScopes.includes(scope),
            ) &&
            // project
            role.projectAccessScopes.length >= memberProjectAccessScopes.length &&
            role.projectAccessScopes.every(scope => memberProjectAccessScopes.includes(scope)) &&
            // target
            role.targetAccessScopes.length >= memberTargetAccessScopes.length &&
            role.targetAccessScopes.every(scope => memberTargetAccessScopes.includes(scope));
          const canAssign =
            (hasAccessToScopesOfRole && newRoleHasMoreOrEqualAccess) || canDowngrade;
          //
          // A new role can be assigned to the member if:
          // - the member is not the owner
          // - the member is not the current user
          // - the current user has access to all the access scopes of the new role
          // - the new role has more or equal access scopes than the current role (or the current user is an admin)
          // - the new role is not the current role
          //

          if (isCurrentRole) {
            return {
              active: false,
              reason: 'This is the current role',
            };
          }

          if (canAssign) {
            return {
              active: true,
            };
          }

          if (!hasAccessToScopesOfRole) {
            return {
              active: false,
              reason: 'You do not have enough access to assign this role',
            };
          }

          if (!newRoleHasMoreOrEqualAccess) {
            return {
              active: false,
              reason:
                'The member will experience a downgrade as this role lacks certain permissions they currently possess.',
            };
          }

          return {
            active: false,
          };
        }}
      />
      {!props.memberRoleId && member ? (
        <>
          <TooltipProvider>
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="relative top-[3px] ml-2"
                  disabled={!canAssignRole}
                  onClick={togglePermissionsModalOpen}
                >
                  <SettingsIcon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Change permissions (legacy)</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <ChangePermissionsModal
            isOpen={isPermissionsModalOpen}
            toggleModalOpen={togglePermissionsModalOpen}
            organization={organization}
            member={member}
          />
        </>
      ) : null}
    </>
  );
}

export const authProviderToIconAndTextMap: Record<
  AuthProvider,
  {
    icon: IconType;
    text: string;
  }
> = {
  [AuthProvider.Google]: {
    icon: FaGoogle,
    text: 'Google OAuth 2.0',
  },
  [AuthProvider.Github]: {
    icon: FaGithub,
    text: 'GitHub OAuth 2.0',
  },
  [AuthProvider.Oidc]: {
    icon: FaOpenid,
    text: 'OpenID Connect',
  },
  [AuthProvider.UsernamePassword]: {
    icon: FaUserLock,
    text: 'Email & Password',
  },
};

const OrganizationMemberRow_DeleteMember = graphql(`
  mutation OrganizationMemberRow_DeleteMember($input: OrganizationMemberInput!) {
    deleteOrganizationMember(input: $input) {
      organization {
        id
        members {
          total
          nodes {
            ...OrganizationMemberRow_MemberFragment
          }
        }
      }
    }
  }
`);

const OrganizationMemberRow_MemberFragment = graphql(`
  fragment OrganizationMemberRow_MemberFragment on Member {
    id
    user {
      id
      provider
      displayName
      email
    }
    role {
      id
      name
    }

    ...ChangePermissionsModal_MemberFragment
    ...OrganizationMemberRoleSwitcher_MemberFragment
  }
`);

function OrganizationMemberRow(props: {
  organization: FragmentType<typeof OrganizationMembers_OrganizationFragment>;
  member: FragmentType<typeof OrganizationMemberRow_MemberFragment>;
  refetchMembers(): void;
}) {
  const organization = useFragment(OrganizationMembers_OrganizationFragment, props.organization);
  const member = useFragment(OrganizationMemberRow_MemberFragment, props.member);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleteMemberState, deleteMember] = useMutation(OrganizationMemberRow_DeleteMember);
  const IconToUse = authProviderToIconAndTextMap[member.user.provider].icon;
  const authMethod = authProviderToIconAndTextMap[member.user.provider].text;
  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        {open ? (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete{' '}
                <strong>{member.user.email}</strong> from the organization.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMemberState.fetching}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteMemberState.fetching}
                onClick={async event => {
                  event.preventDefault();

                  try {
                    const result = await deleteMember({
                      input: {
                        organization: organization.cleanId,
                        user: member.user.id,
                      },
                    });

                    if (result.error) {
                      toast({
                        variant: 'destructive',
                        title: 'Failed to delete a member',
                        description: result.error.message,
                      });
                    } else {
                      toast({
                        title: 'Member deleted',
                        description: `User ${member.user.email} is no longer a member of the organization`,
                      });
                      setOpen(false);
                    }
                  } catch (error) {
                    console.log('Failed to delete a member');
                    console.error(error);
                    toast({
                      variant: 'destructive',
                      title: 'Failed to delete a member',
                      description: String(error),
                    });
                  }
                }}
              >
                {deleteMemberState.fetching ? 'Deleting...' : 'Continue'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
      <tr key={member.id}>
        <td className="w-12">
          <TooltipProvider>
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <div>
                  <IconToUse className="mx-auto h-5 w-5" />
                </div>
              </TooltipTrigger>
              <TooltipContent>User's authentication method: {authMethod}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </td>
        <td className="grow overflow-hidden py-3 text-sm font-medium">
          <h3 className="line-clamp-1 font-medium">{member.user.displayName}</h3>
          <h4 className="text-xs text-gray-400">{member.user.email}</h4>
        </td>
        <td className="relative py-3 text-center text-sm">
          <OrganizationMemberRoleSwitcher
            organization={organization}
            memberId={member.id}
            memberName={member.user.displayName}
            memberRoleId={member.role?.id}
            member={member}
          />
        </td>
        <td className="py-3 text-right text-sm">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="data-[state=open]:bg-muted flex h-8 w-8 p-0">
                <MoreHorizontalIcon className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[160px]">
              <DropdownMenuItem onSelect={() => setOpen(true)}>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>
    </>
  );
}

const OrganizationMembers_OrganizationFragment = graphql(`
  fragment OrganizationMembers_OrganizationFragment on Organization {
    id
    cleanId
    owner {
      id
    }
    me {
      id
    }
    members {
      nodes {
        id
        user {
          displayName
        }
        role {
          id
          name
        }
        ...OrganizationMemberRow_MemberFragment
      }
      total
    }
    ...OrganizationMemberRoleSwitcher_OrganizationFragment
    ...MemberInvitationForm_OrganizationFragment
  }
`);

export function OrganizationMembers(props: {
  organization: FragmentType<typeof OrganizationMembers_OrganizationFragment>;
  refetchMembers(): void;
}) {
  const organization = useFragment(OrganizationMembers_OrganizationFragment, props.organization);
  const members = organization.members.nodes;
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc' | null>(null);
  const [sortByKey, setSortByKey] = useState<'name' | 'role'>('name');

  const sortedMembers = useMemo(() => {
    if (!members) {
      return [];
    }

    if (!orderDirection) {
      return members ?? [];
    }

    const sorted = [...members].sort((a, b) => {
      if (sortByKey === 'name') {
        return a.user.displayName.localeCompare(b.user.displayName);
      }

      if (sortByKey === 'role') {
        return (a.role?.name ?? 'Select role').localeCompare(b.role?.name ?? 'Select role') ?? 0;
      }

      return 0;
    });

    return orderDirection === 'asc' ? sorted : sorted.reverse();
  }, [members, orderDirection, sortByKey]);

  const updateSorting = useCallback(
    (newSortBy: 'name' | 'role') => {
      if (newSortBy === sortByKey) {
        setOrderDirection(
          orderDirection === 'asc' ? 'desc' : orderDirection === 'desc' ? null : 'asc',
        );
      } else {
        setSortByKey(newSortBy);
        setOrderDirection('asc');
      }
    },
    [sortByKey, orderDirection],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between">
        <div className="space-y-2">
          <CardTitle>List of organization members</CardTitle>
          <CardDescription>
            Manage the members of your organization and their permissions.
          </CardDescription>
        </div>
        <div>
          <MemberInvitationButton
            refetchInvitations={props.refetchMembers}
            organization={organization}
          />
        </div>
      </div>
      <table className="w-full table-auto divide-y-[1px] divide-gray-500/20">
        <thead>
          <tr>
            <th
              colSpan={2}
              className="relative cursor-pointer select-none py-3 text-left text-sm font-semibold"
              onClick={() => updateSorting('name')}
            >
              Member
              <span className="inline-block">
                {sortByKey === 'name' ? (
                  orderDirection === 'asc' ? (
                    <MoveUpIcon className="relative top-[3px] h-4 w-4" />
                  ) : orderDirection === 'desc' ? (
                    <MoveDownIcon className="relative top-[3px] h-4 w-4" />
                  ) : null
                ) : null}
              </span>
            </th>
            <th
              className="relative w-[300px] cursor-pointer select-none py-3 text-center align-middle text-sm font-semibold"
              onClick={() => updateSorting('role')}
            >
              Assigned Role
              <span className="inline-block">
                {sortByKey === 'role' ? (
                  orderDirection === 'asc' ? (
                    <MoveUpIcon className="relative top-[3px] h-4 w-4" />
                  ) : orderDirection === 'desc' ? (
                    <MoveDownIcon className="relative top-[3px] h-4 w-4" />
                  ) : null
                ) : null}
              </span>
            </th>
            <th className="w-12 py-3 text-right text-sm font-semibold" />
          </tr>
        </thead>
        <tbody className="divide-y-[1px] divide-gray-500/20">
          {sortedMembers.map(node => (
            <OrganizationMemberRow
              key={node.id}
              refetchMembers={props.refetchMembers}
              organization={props.organization}
              member={node}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
