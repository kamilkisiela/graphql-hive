import { OrganizationManager } from '../providers/organization-manager';
import type { MemberResolvers } from './../../../__generated__/types.next';

export const Member: Pick<
  MemberResolvers,
  'canLeaveOrganization' | 'isAdmin' | 'role' | '__isTypeOf'
> = {
  canLeaveOrganization: async (member, _, { injector }) => {
    const { result } = await injector.get(OrganizationManager).canLeaveOrganization({
      organizationId: member.organization,
      userId: member.user.id,
    });

    return result;
  },
  isAdmin: (member, _, { injector }) => {
    return member.isOwner || injector.get(OrganizationManager).isAdminRole(member.role);
  },
};
