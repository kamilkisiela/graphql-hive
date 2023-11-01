import { FormEventHandler, memo, ReactElement, useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { useMutation } from 'urql';
import { Accordion, RadixSelect, Tooltip } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { OrganizationAccessScope, ProjectAccessScope, TargetAccessScope } from '@/graphql';
import { NoAccess, Scope } from '@/lib/access/common';
import { canAccessOrganization } from '@/lib/access/organization';
import { canAccessProject } from '@/lib/access/project';
import { canAccessTarget } from '@/lib/access/target';
import { useNotifications } from '@/lib/hooks';
import { truthy } from '@/utils';

const OrganizationPermissions_UpdateMemberAccessMutation = graphql(`
  mutation OrganizationPermissions_UpdateMemberAccessMutation(
    $input: OrganizationMemberAccessInput!
  ) {
    updateOrganizationMemberAccess(input: $input) {
      selector {
        organization
      }
      organization {
        id
        cleanId
        name
      }
    }
  }
`);

interface Props<T> {
  title: string;
  scopes: readonly Scope<T>[];
  initialScopes: readonly T[];
  onChange: (scopes: T[]) => void;
  checkAccess: (scope: T) => boolean;
  isReadOnly?: boolean;
}

function matchScope<T, TDefault = string>(
  list: readonly T[],
  defaultValue: TDefault,
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

export const PermissionScopeItem = <
  T extends OrganizationAccessScope | ProjectAccessScope | TargetAccessScope,
>(props: {
  scope: Scope<T>;
  checkAccess: (scope: T) => boolean;
  selectedScope: typeof NoAccess | T | undefined;
  isReadOnly: boolean;
  onChange: (scopes: T | typeof NoAccess) => void;
  canManageScope: boolean;
  possibleScope: T[];
}): React.ReactElement => {
  const inner = (
    <div
      key={props.scope.name}
      className={clsx(
        'py-2 flex flex-row justify-between items-center',
        props.canManageScope === false ? 'opacity-50' : null,
      )}
    >
      <div>
        <div
          className={clsx(
            'font-semibold text-gray-600',
            props.isReadOnly &&
              props.selectedScope !== 'no-access' &&
              props.canManageScope === false
              ? 'text-red-600'
              : null,
          )}
        >
          {props.scope.name}
        </div>
        <div
          className={clsx(
            'text-xs text-gray-600',
            props.isReadOnly &&
              props.selectedScope !== 'no-access' &&
              props.canManageScope === false
              ? 'text-red-600'
              : null,
          )}
        >
          {props.scope.description}
        </div>
      </div>
      <RadixSelect<T | typeof NoAccess>
        isDisabled={!props.canManageScope || props.isReadOnly}
        className="shrink-0"
        position="popper"
        value={props.selectedScope}
        options={[
          { value: NoAccess, label: 'No access' },
          props.scope.mapping['read-only'] &&
            (props.isReadOnly || props.checkAccess(props.scope.mapping['read-only'])) && {
              value: props.scope.mapping['read-only'],
              label: 'Read-only',
            },
          props.scope.mapping['read-write'] &&
            (props.isReadOnly || props.checkAccess(props.scope.mapping['read-write'])) && {
              value: props.scope.mapping['read-write'],
              label: 'Read & write',
            },
        ].filter(truthy)}
        onChange={value => {
          props.onChange(value);
        }}
      />
    </div>
  );

  return props.canManageScope ? (
    inner
  ) : (
    <Tooltip
      content={
        <>
          Your user account does not have these permissions, thus it can not issue those to the
          access token.
        </>
      }
    >
      {inner}
    </Tooltip>
  );
};

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
          const readOnlyScope = scope.mapping['read-only'];
          const hasReadOnly = typeof readOnlyScope !== 'undefined';

          return (
            <PermissionScopeItem<T>
              scope={scope}
              key={scope.name}
              selectedScope={matchScope(
                props.initialScopes,
                NoAccess,
                scope.mapping['read-only'],
                scope.mapping['read-write'],
              )}
              checkAccess={checkAccess}
              isReadOnly={props.isReadOnly ?? false}
              possibleScope={possibleScope}
              canManageScope={possibleScope.some(checkAccess)}
              onChange={value => {
                if (value === NoAccess) {
                  // Remove all possible scopes
                  onChange(initialScopes.filter(scope => !possibleScope.includes(scope)));
                  return;
                }
                const isReadWrite = value === scope.mapping['read-write'];

                // Remove possible scopes
                const newScopes = props.initialScopes.filter(
                  scope => !possibleScope.includes(scope),
                );

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

                props.onChange(newScopes);
              }}
            />
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
  const [, mutate] = useMutation(OrganizationPermissions_UpdateMemberAccessMutation);

  const [targetScopes, setTargetScopes] = useState<TargetAccessScope[]>(
    passMemberScopes ? member.targetAccessScopes : [],
  );
  const [projectScopes, setProjectScopes] = useState<ProjectAccessScope[]>(
    passMemberScopes ? member.projectAccessScopes : [],
  );
  const [organizationScopes, setOrganizationScopes] = useState<OrganizationAccessScope[]>(
    passMemberScopes ? member.organizationAccessScopes : [],
  );

  useEffect(() => {
    if (passMemberScopes) {
      setTargetScopes(member.targetAccessScopes);
      setProjectScopes(member.projectAccessScopes);
      setOrganizationScopes(member.organizationAccessScopes);
    }
  }, [member, passMemberScopes, setTargetScopes, setProjectScopes, setOrganizationScopes]);

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
