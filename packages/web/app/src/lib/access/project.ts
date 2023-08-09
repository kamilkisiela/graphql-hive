import { FragmentType, graphql, useFragment } from '@/gql';
import { ProjectAccessScope } from '../../graphql';
import { useRedirect } from './common';

export { ProjectAccessScope };

const CanAccessProject_MemberFragment = graphql(`
  fragment CanAccessProject_MemberFragment on Member {
    projectAccessScopes
  }
`);

export function canAccessProject(
  scope: ProjectAccessScope,
  mmember: null | FragmentType<typeof CanAccessProject_MemberFragment>,
) {
  const member = useFragment(CanAccessProject_MemberFragment, mmember);
  if (!member) {
    return false;
  }

  return member.projectAccessScopes.includes(scope);
}

export function useProjectAccess({
  scope,
  member: mmember,
  redirect = false,
}: {
  scope: ProjectAccessScope;
  member: null | FragmentType<typeof CanAccessProject_MemberFragment>;
  redirect?: boolean;
}) {
  const member = useFragment(CanAccessProject_MemberFragment, mmember);

  const canAccess = canAccessProject(scope, mmember);
  useRedirect({
    canAccess,
    redirectTo: redirect
      ? router => ({
          route: '/[organizationId]/[projectId]',
          as: `/${router.query.organizationId}/${router.query.projectId}`,
        })
      : undefined,
    entity: member,
  });

  return canAccess;
}
