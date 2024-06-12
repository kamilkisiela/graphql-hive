import { FragmentType, graphql, useFragment } from '@/gql';
import { TargetAccessScope } from '@/gql/graphql';
import { useRedirect } from './common';

export { TargetAccessScope };

const CanAccessTarget_MemberFragment = graphql(`
  fragment CanAccessTarget_MemberFragment on Member {
    id
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
  organizationId,
  projectId,
  targetId,
}: {
  scope: TargetAccessScope;
  member: null | FragmentType<typeof CanAccessTarget_MemberFragment>;
  redirect?: boolean;
  organizationId: string;
  projectId: string;
  targetId: string;
}) {
  const member = useFragment(CanAccessTarget_MemberFragment, mmember);
  const canAccess = canAccessTarget(scope, mmember);
  useRedirect({
    canAccess,
    redirectTo: redirect
      ? router => {
          void router.navigate({
            to: '/$organizationId/$projectId/$targetId',
            params: {
              organizationId,
              projectId,
              targetId,
            },
          });
        }
      : undefined,
    entity: member,
  });

  return canAccess;
}
