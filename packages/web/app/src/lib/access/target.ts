import { useRedirect } from './common';
import { MemberFieldsFragment, TargetAccessScope } from '../../graphql';

export { TargetAccessScope } from '../../graphql';

export function canAccessTarget(scope: TargetAccessScope, member: Pick<MemberFieldsFragment, 'targetAccessScopes'>) {
  if (!member) {
    return false;
  }

  return member.targetAccessScopes.includes(scope);
}

export function useTargetAccess({
  scope,
  member,
  redirect = false,
}: {
  scope: TargetAccessScope;
  member: Pick<MemberFieldsFragment, 'targetAccessScopes'>;
  redirect?: boolean;
}) {
  const canAccess = canAccessTarget(scope, member);
  useRedirect({
    canAccess,
    redirectTo: redirect
      ? router => ({
          route: `/[orgId]/[projectId]/[targetId]`,
          as: `/${router.query.orgId}/${router.query.projectId}/${router.query.targetId}`,
        })
      : undefined,
    entity: member,
  });

  return canAccess;
}
