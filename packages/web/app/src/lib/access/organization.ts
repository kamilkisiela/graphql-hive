import { MemberFieldsFragment, OrganizationAccessScope } from '../../graphql';
import { useRedirect } from './common';

export { OrganizationAccessScope } from '../../graphql';

export function canAccessOrganization(
  scope: OrganizationAccessScope,
  member: Pick<MemberFieldsFragment, 'organizationAccessScopes'> | null | undefined
) {
  if (!member) {
    return false;
  }

  return member.organizationAccessScopes.includes(scope);
}

export function useOrganizationAccess({
  scope,
  member,
  redirect = false,
}: {
  scope: OrganizationAccessScope;
  member: Pick<MemberFieldsFragment, 'organizationAccessScopes'> | null | undefined;
  redirect?: boolean;
}) {
  const canAccess = canAccessOrganization(scope, member);
  useRedirect({
    canAccess,
    redirectTo: redirect
      ? router => ({
          route: `/[orgId]`,
          as: `/${router.query.orgId}`,
        })
      : undefined,
    entity: member,
  });

  return canAccess;
}
