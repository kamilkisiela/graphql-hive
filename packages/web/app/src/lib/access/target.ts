import { FragmentType, graphql, useFragment } from '@/gql';
import { TargetAccessScope } from '../../graphql';
import { useRedirect } from './common';

export { TargetAccessScope };

export const CanAccessTarget_MemberFragment = graphql(`
  fragment CanAccessTarget_MemberFragment on Member {
    targetAccessScopes
  }
`);

export function canAccessTarget(
  scope: TargetAccessScope,
  mmember: null | FragmentType<typeof CanAccessTarget_MemberFragment>,
) {
  const member = useFragment(CanAccessTarget_MemberFragment, mmember);

  if (!member) {
    return false;
  }

  return member.targetAccessScopes.includes(scope);
}

export function useTargetAccess({
  scope,
  member: mmember,
  redirect = false,
}: {
  scope: TargetAccessScope;
  member: null | FragmentType<typeof CanAccessTarget_MemberFragment>;
  redirect?: boolean;
}) {
  const member = useFragment(CanAccessTarget_MemberFragment, mmember);
  const canAccess = canAccessTarget(scope, mmember);
  useRedirect({
    canAccess,
    redirectTo: redirect
      ? router => ({
          route: '/[organizationId]/[projectId]/[targetId]',
          as: `/${router.query.organizationId}/${router.query.projectId}/${router.query.targetId}`,
        })
      : undefined,
    entity: member,
  });

  return canAccess;
}
