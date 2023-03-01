import { FormEventHandler, memo, ReactElement, useCallback, useState } from 'react';
import { useMutation } from 'urql';
import { Accordion, RadixSelect } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import {
  OrganizationAccessScope,
  ProjectAccessScope,
  TargetAccessScope,
  UpdateOrganizationMemberAccessDocument,
} from '@/graphql';
import { NoAccess, Scope } from '@/lib/access/common';
import { canAccessOrganization } from '@/lib/access/organization';
import { canAccessProject } from '@/lib/access/project';
import { canAccessTarget } from '@/lib/access/target';
import { useNotifications } from '@/lib/hooks';
import { truthy } from '@/utils';

interface Props<T> {
  title: string;
  scopes: readonly Scope<T>[];
  initialScopes: readonly T[];
  onChange: (scopes: T[]) => void;
  checkAccess: (scope: T) => boolean;
}

function matchScope<T>(
  list: readonly T[],
  defaultValue: string,
  lowerPriority?: T,
  higherPriority?: T,
) {
  let hasHigher = false;
  let hasLower = false;

  for (const item of list) {
    if (item === higherPriority) {
      hasHigher = true;
    } else if (item === lowerPriority) {
      hasLower = true;
    }
  }

  if (hasHigher) {
    return higherPriority;
  }

  if (hasLower) {
    return lowerPriority;
  }

  return defaultValue;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== undefined && value !== null;
}

function PermissionsSpaceInner(props: Props<OrganizationAccessScope>): ReactElement<any, any>;
function PermissionsSpaceInner(props: Props<ProjectAccessScope>): ReactElement<any, any>;
function PermissionsSpaceInner(props: Props<TargetAccessScope>): ReactElement<any, any>;
function PermissionsSpaceInner<
  T extends OrganizationAccessScope | ProjectAccessScope | TargetAccessScope,
>(props: Props<T>) {
  const { title, scopes, initialScopes, onChange, checkAccess } = props;

  return (
    <Accordion.Item value={title}>
      <Accordion.Header>{title}</Accordion.Header>
      <Accordion.Content>
        {scopes.map(scope => {
          const possibleScope = [scope.mapping['read-only'], scope.mapping['read-write']].filter(
            isDefined,
          );
          const canManageScope = possibleScope.some(checkAccess);

          if (!canManageScope) {
            return null;
          }

          const readOnlyScope = scope.mapping['read-only'];
          const hasReadOnly = typeof readOnlyScope !== 'undefined';

          const selectedScope = matchScope(
            initialScopes,
            NoAccess,
            scope.mapping['read-only'],
            scope.mapping['read-write'],
          );

          return (
            <div className="py-2 flex flex-row justify-between items-center" key={scope.name}>
              <div>
                <div className="font-semibold text-gray-600">{scope.name}</div>
                <div className="text-xs text-gray-600">{scope.description}</div>
              </div>
              <RadixSelect
                className="shrink-0"
                position="popper"
                value={selectedScope}
                options={[
                  { value: NoAccess, label: 'No access' },
                  scope.mapping['read-only'] &&
                    checkAccess(scope.mapping['read-only']) && {
                      value: scope.mapping['read-only'],
                      label: 'Read-only',
                    },
                  scope.mapping['read-write'] &&
                    checkAccess(scope.mapping['read-write']) && {
                      value: scope.mapping['read-write'],
                      label: 'Read & write',
                    },
                ].filter(truthy)}
                onChange={value => {
                  if (value === NoAccess) {
                    // Remove all possible scopes
                    onChange(initialScopes.filter(scope => !possibleScope.includes(scope)));
                    return;
                  }
                  const isReadWrite = value === scope.mapping['read-write'];

                  // Remove possible scopes
                  const newScopes = initialScopes.filter(scope => !possibleScope.includes(scope));

                  if (isReadWrite) {
                    newScopes.push(scope.mapping['read-write']);

                    if (hasReadOnly) {
                      // Include read-only as well
                      newScopes.push(readOnlyScope);
                    }
                  } else if (readOnlyScope) {
                    // just read-only
                    newScopes.push(readOnlyScope);
                  }

                  onChange(newScopes);
                }}
              />
            </div>
          );
        })}
      </Accordion.Content>
    </Accordion.Item>
  );
}

export const PermissionsSpace = memo(
  PermissionsSpaceInner,
) as unknown as typeof PermissionsSpaceInner;

const UsePermissionManager_OrganizationFragment = graphql(`
  fragment UsePermissionManager_OrganizationFragment on Organization {
    cleanId
    me {
      ...CanAccessOrganization_MemberFragment
      ...CanAccessProject_MemberFragment
      ...CanAccessTarget_MemberFragment
    }
  }
`);

const UsePermissionManager_MemberFragment = graphql(`
  fragment UsePermissionManager_MemberFragment on Member {
    id
    targetAccessScopes
    projectAccessScopes
    organizationAccessScopes
  }
`);

export function usePermissionsManager({
  onSuccess,
  passMemberScopes,
  ...props
}: {
  organization: FragmentType<typeof UsePermissionManager_OrganizationFragment>;
  member: FragmentType<typeof UsePermissionManager_MemberFragment>;
  passMemberScopes: boolean;
  onSuccess(): void;
}) {
  const member = useFragment(UsePermissionManager_MemberFragment, props.member);
  const organization = useFragment(UsePermissionManager_OrganizationFragment, props.organization);
  const [state, setState] = useState<'LOADING' | 'IDLE'>('IDLE');
  const notify = useNotifications();
  const [, mutate] = useMutation(UpdateOrganizationMemberAccessDocument);

  const [targetScopes, setTargetScopes] = useState<TargetAccessScope[]>(
    passMemberScopes ? member.targetAccessScopes : [],
  );
  const [projectScopes, setProjectScopes] = useState<ProjectAccessScope[]>(
    passMemberScopes ? member.projectAccessScopes : [],
  );
  const [organizationScopes, setOrganizationScopes] = useState<OrganizationAccessScope[]>(
    passMemberScopes ? member.organizationAccessScopes : [],
  );

  const submit = useCallback<FormEventHandler<HTMLElement>>(
    async evt => {
      evt.preventDefault();
      setState('LOADING');
      const result = await mutate({
        input: {
          organization: organization.cleanId,
          user: member.id,
          targetScopes,
          projectScopes,
          organizationScopes,
        },
      });
      setState('IDLE');
      if (result.error) {
        notify(`Failed to change access (reason: ${result.error.message}`, 'error');
      } else {
        onSuccess();
        notify('Member access saved', 'success');
      }
    },
    [
      mutate,
      notify,
      setState,
      targetScopes,
      projectScopes,
      organizationScopes,
      organization,
      member,
      onSuccess,
    ],
  );

  return {
    // Set
    setOrganizationScopes,
    setProjectScopes,
    setTargetScopes,
    submit,
    // Get
    organizationScopes,
    projectScopes,
    targetScopes,
    state,
    noneSelected: !organizationScopes.length && !projectScopes.length && !targetScopes.length,
    // Methods
    canAccessOrganization: useCallback(
      (scope: OrganizationAccessScope) => canAccessOrganization(scope, organization.me),
      [organization],
    ),
    canAccessProject: useCallback(
      (scope: ProjectAccessScope) => canAccessProject(scope, organization.me),
      [organization],
    ),
    canAccessTarget: useCallback(
      (scope: TargetAccessScope) => canAccessTarget(scope, organization.me),
      [organization],
    ),
  };
}
