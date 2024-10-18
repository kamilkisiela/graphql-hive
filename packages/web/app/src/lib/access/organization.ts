import { FragmentType, graphql, useFragment } from '@/gql';
import { OrganizationAccessScope } from '@/gql/graphql';
import { useRedirect } from './common';

export { OrganizationAccessScope };

const CanAccessOrganization_MemberFragment = graphql(`
  fragment CanAccessOrganization_MemberFragment on Member {
    id
    organizationAccessScopes
  }
`);

export function canAccessOrganization(
  scope: OrganizationAccessScope,
  mmember: null | FragmentType<typeof CanAccessOrganization_MemberFragment>,
) {
  const member = useFragment(CanAccessOrganization_MemberFragment, mmember);
  if (!member) {
    return false;
  }

  return member.organizationAccessScopes.includes(scope);
}

export function useOrganizationAccess({
  scope,
  organizationSlug,
  member: mmember,
  redirect = false,
}: {
  scope: OrganizationAccessScope;
  member: null | FragmentType<typeof CanAccessOrganization_MemberFragment>;
  redirect?: boolean;
  organizationSlug: string;
}) {
  const member = useFragment(CanAccessOrganization_MemberFragment, mmember);
  const canAccess = canAccessOrganization(scope, mmember);

  useRedirect({
    canAccess,
    redirectTo: redirect
      ? router => {
          void router.navigate({
            to: '/$organizationSlug',
            params: {
              organizationSlug,
            },
          });
        }
      : undefined,
    entity: member,
  });

  return canAccess;
}
