import { createHash } from 'node:crypto';
import { AuthManager } from '../../auth/providers/auth-manager';
import {
  isOrganizationScope,
  OrganizationAccessScope,
} from '../../auth/providers/organization-access';
import { isProjectScope, ProjectAccessScope } from '../../auth/providers/project-access';
import { isTargetScope, TargetAccessScope } from '../../auth/providers/target-access';
import { OrganizationManager } from '../providers/organization-manager';
import type { OrganizationResolvers } from './../../../__generated__/types.next';

export const Organization: Pick<
  OrganizationResolvers,
  | 'cleanId'
  | 'getStarted'
  | 'id'
  | 'invitations'
  | 'me'
  | 'memberRoles'
  | 'members'
  | 'name'
  | 'owner'
  | 'slug'
  | 'unassignedMembersToMigrate'
  | '__isTypeOf'
> = {
  __isTypeOf: organization => {
    return !!organization.id;
  },
  owner: (organization, _, { injector }) => {
    return injector
      .get(OrganizationManager)
      .getOrganizationOwner({ organization: organization.id });
  },
  me: async (organization, _, { injector }) => {
    const me = await injector.get(AuthManager).getCurrentUser();
    const members = await injector
      .get(OrganizationManager)
      .getOrganizationMembers({ organization: organization.id });

    return members.find(m => m.id === me.id)!;
  },
  members: (organization, _, { injector }) => {
    return injector
      .get(OrganizationManager)
      .getOrganizationMembers({ organization: organization.id });
  },
  invitations: async (organization, _, { injector }) => {
    const invitations = await injector.get(OrganizationManager).getInvitations({
      organization: organization.id,
    });

    return {
      total: invitations.length,
      nodes: invitations,
    };
  },
  memberRoles: (organization, _, { injector }) => {
    return injector.get(OrganizationManager).getMemberRoles({
      organizationId: organization.id,
    });
  },
  unassignedMembersToMigrate: async (organization, _, { injector }) => {
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
  cleanId: organization => organization.slug,
};
