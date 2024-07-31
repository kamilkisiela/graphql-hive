import { createConnection } from '../../shared/schema';
import { AuthManager } from '../auth/providers/auth-manager';
import { isOrganizationScope } from '../auth/providers/organization-access';
import { isProjectScope } from '../auth/providers/project-access';
import { isTargetScope } from '../auth/providers/target-access';
import type { OrganizationModule } from './__generated__/types';
import { OrganizationManager } from './providers/organization-manager';

export const resolvers: OrganizationModule.Resolvers = {
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
