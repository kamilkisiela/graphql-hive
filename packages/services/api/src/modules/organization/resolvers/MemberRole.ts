import { AuthManager } from '../../auth/providers/auth-manager';
import { isOrganizationScope } from '../../auth/providers/organization-access';
import { isProjectScope } from '../../auth/providers/project-access';
import { isTargetScope } from '../../auth/providers/target-access';
import { OrganizationManager } from '../providers/organization-manager';
import type { MemberRoleResolvers } from './../../../__generated__/types.next';

export const MemberRole: MemberRoleResolvers = {
  organizationAccessScopes: role => {
    return role.scopes.filter(isOrganizationScope);
  },
  projectAccessScopes: role => {
    return role.scopes.filter(isProjectScope);
  },
  targetAccessScopes: role => {
    return role.scopes.filter(isTargetScope);
  },
  membersCount: async (role, _, { injector }) => {
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
  canDelete: async (role, _, { injector }) => {
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
  canUpdate: async (role, _, { injector }) => {
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
  canInvite: async (role, _, { injector }) => {
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
};
