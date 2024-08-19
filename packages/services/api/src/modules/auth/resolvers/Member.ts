import { AuthManager } from '../providers/auth-manager';
import type { MemberResolvers } from './../../../__generated__/types.next';

export const Member: Pick<
  MemberResolvers,
  | 'id'
  | 'isOwner'
  | 'organizationAccessScopes'
  | 'projectAccessScopes'
  | 'targetAccessScopes'
  | 'user'
  | '__isTypeOf'
> = {
  organizationAccessScopes: (member, _, { injector }) => {
    return injector.get(AuthManager).getMemberOrganizationScopes({
      user: member.user.id,
      organization: member.organization,
    });
  },
  projectAccessScopes: (member, _, { injector }) => {
    return injector.get(AuthManager).getMemberProjectScopes({
      user: member.user.id,
      organization: member.organization,
    });
  },
  targetAccessScopes: (member, _, { injector }) => {
    return injector.get(AuthManager).getMemberTargetScopes({
      user: member.user.id,
      organization: member.organization,
    });
  },
};
