import { MemberFieldsFragment, ProjectAccessScope } from '../../graphql';
import { useRedirect } from './common';

export { ProjectAccessScope } from '../../graphql';

export function canAccessProject(
  scope: ProjectAccessScope,
  member: Pick<MemberFieldsFragment, 'projectAccessScopes'>
) {
  if (!member) {
    return false;
  }

  return member.projectAccessScopes.includes(scope);
}

export function useProjectAccess({
  scope,
  member,
  redirect = false,
}: {
  scope: ProjectAccessScope;
  member: Pick<MemberFieldsFragment, 'projectAccessScopes'>;
  redirect?: boolean;
}) {
  const canAccess = canAccessProject(scope, member);
  useRedirect({
    canAccess,
    redirectTo: redirect
      ? (router) => ({
          route: `/[orgId]/[projectId]`,
          as: `/${router.query.orgId}/${router.query.projectId}`,
        })
      : undefined,
    entity: member,
  });

  return canAccess;
}
