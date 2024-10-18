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
  organizationSlug,
  projectSlug,
  targetSlug,
}: {
  scope: TargetAccessScope;
  member: null | FragmentType<typeof CanAccessTarget_MemberFragment>;
  redirect?: boolean;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const member = useFragment(CanAccessTarget_MemberFragment, mmember);
  const canAccess = canAccessTarget(scope, mmember);
  useRedirect({
    canAccess,
    redirectTo: redirect
      ? router => {
          void router.navigate({
            to: '/$organizationSlug/$projectSlug/$targetSlug',
            params: {
              organizationSlug,
              projectSlug,
              targetSlug,
            },
          });
        }
      : undefined,
    entity: member,
  });

  return canAccess;
}
