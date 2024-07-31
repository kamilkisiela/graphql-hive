import { createHash } from 'node:crypto';
import { createConnection } from '../../shared/schema';
import { AuthManager } from '../auth/providers/auth-manager';
import {
  isOrganizationScope,
  OrganizationAccessScope,
} from '../auth/providers/organization-access';
import { isProjectScope, ProjectAccessScope } from '../auth/providers/project-access';
import { isTargetScope, TargetAccessScope } from '../auth/providers/target-access';
import type { OrganizationModule } from './__generated__/types';
import { OrganizationManager } from './providers/organization-manager';

export const resolvers: OrganizationModule.Resolvers = {
  Organization: {
    __isTypeOf(organization) {
      return !!organization.id;
    },
    owner(organization, _, { injector }) {
      return injector
        .get(OrganizationManager)
        .getOrganizationOwner({ organization: organization.id });
    },
    async me(organization, _, { injector }) {
      const me = await injector.get(AuthManager).getCurrentUser();
      const members = await injector
        .get(OrganizationManager)
        .getOrganizationMembers({ organization: organization.id });

      return members.find(m => m.id === me.id)!;
    },
    members(organization, _, { injector }) {
      return injector
        .get(OrganizationManager)
        .getOrganizationMembers({ organization: organization.id });
    },
    async invitations(organization, _, { injector }) {
      const invitations = await injector.get(OrganizationManager).getInvitations({
        organization: organization.id,
      });

      return {
        total: invitations.length,
        nodes: invitations,
      };
    },
    memberRoles(organization, _, { injector }) {
      return injector.get(OrganizationManager).getMemberRoles({
        organizationId: organization.id,
      });
    },
    async unassignedMembersToMigrate(organization, _, { injector }) {
      const members = await injector.get(OrganizationManager).getMembersWithoutRole({
        organizationId: organization.id,
      });

      if (members.length === 0) {
        return [];
      }

      const groupedByAccessScope: {
        [accessHash: string]: {
          organizationScopes: OrganizationAccessScope[];
          projectScopes: ProjectAccessScope[];
          targetScopes: TargetAccessScope[];
          members: Array<(typeof members)[number]>;
        };
      } = {};

      for (const member of members) {
        const hasher = createHash('md5');
        hasher.update([...member.scopes].sort().join(','));
        const accessHash = hasher.digest('hex');

        if (!groupedByAccessScope[accessHash]) {
          groupedByAccessScope[accessHash] = {
            organizationScopes: member.scopes.filter(isOrganizationScope),
            projectScopes: member.scopes.filter(isProjectScope),
            targetScopes: member.scopes.filter(isTargetScope),
            members: [],
          };
        }

        groupedByAccessScope[accessHash].members.push(member);
      }

      return (
        Object.entries(groupedByAccessScope)
          .map(([accessHash, group]) => ({
            id: accessHash,
            organizationScopes: group.organizationScopes,
            projectScopes: group.projectScopes,
            targetScopes: group.targetScopes,
            members: group.members,
          }))
          // Sort by the number of members in the group in descending order
          .sort((a, b) => b.members.length - a.members.length)
      );
    },
  },
  OrganizationInvitation: {
    id(invitation) {
      return Buffer.from(
        [invitation.organization_id, invitation.email, invitation.code].join(':'),
      ).toString('hex');
    },
    createdAt(invitation) {
      return invitation.created_at;
    },
    expiresAt(invitation) {
      return invitation.expires_at;
    },
  },
  OrganizationInvitationError: {
    __isTypeOf(obj) {
      return !!obj.message;
    },
  },
  OrganizationInvitationPayload: {
    __isTypeOf(organization) {
      return !!organization.name;
    },
    name(organization) {
      return organization.name;
    },
  },
  Member: {
    async canLeaveOrganization(member, _, { injector }) {
      const { result } = await injector.get(OrganizationManager).canLeaveOrganization({
        organizationId: member.organization,
        userId: member.user.id,
      });

      return result;
    },
    isAdmin(member, _, { injector }) {
      return member.isOwner || injector.get(OrganizationManager).isAdminRole(member.role);
    },
  },
  MemberRole: {
    organizationAccessScopes(role) {
      return role.scopes.filter(isOrganizationScope);
    },
    projectAccessScopes(role) {
      return role.scopes.filter(isProjectScope);
    },
    targetAccessScopes(role) {
      return role.scopes.filter(isTargetScope);
    },
    async membersCount(role, _, { injector }) {
      if (role.membersCount) {
        return role.membersCount;
      }

      return injector
        .get(OrganizationManager)
        .getMemberRole({
          organizationId: role.organizationId,
          roleId: role.id,
        })
        .then(r => r?.membersCount ?? 0);
    },
    async canDelete(role, _, { injector }) {
      if (role.locked) {
        return false;
      }

      const currentUser = await injector.get(AuthManager).getCurrentUser();
      const currentUserAsMember = await injector.get(OrganizationManager).getOrganizationMember({
        organization: role.organizationId,
        user: currentUser.id,
      });

      const result = await injector
        .get(OrganizationManager)
        .canDeleteRole(role, currentUserAsMember.scopes);

      return result.ok;
    },
    async canUpdate(role, _, { injector }) {
      if (role.locked) {
        return false;
      }
      const currentUser = await injector.get(AuthManager).getCurrentUser();
      const currentUserAsMember = await injector.get(OrganizationManager).getOrganizationMember({
        organization: role.organizationId,
        user: currentUser.id,
      });

      const result = injector
        .get(OrganizationManager)
        .canUpdateRole(role, currentUserAsMember.scopes);

      return result.ok;
    },
    async canInvite(role, _, { injector }) {
      const currentUser = await injector.get(AuthManager).getCurrentUser();
      const currentUserAsMember = await injector.get(OrganizationManager).getOrganizationMember({
        organization: role.organizationId,
        user: currentUser.id,
      });

      const result = injector
        .get(OrganizationManager)
        .canInviteRole(role, currentUserAsMember.scopes);

      return result.ok;
    },
  },
  OrganizationConnection: createConnection(),
};
