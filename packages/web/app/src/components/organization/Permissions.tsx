import { FormEventHandler, memo, ReactElement, useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { useMutation } from 'urql';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  scopes: readonly Scope<T>[];
  initialScopes: readonly T[];
  selectedScopes: readonly T[];
  onChange: (scopes: T[]) => void;
  checkAccess: (scope: T) => boolean;
  noDowngrade?: boolean;
  disabled?: boolean;
}

function isLowerThen<T>(targetScope: T, sourceScope: T, scopesInLowerToHigherOrder: readonly T[]) {
  const sourceIndex = scopesInLowerToHigherOrder.indexOf(sourceScope);
  const targetIndex = scopesInLowerToHigherOrder.indexOf(targetScope);

  return targetIndex < sourceIndex;
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
  disabled?: boolean;
  scope: Scope<T>;
  checkAccess: (scope: T) => boolean;
  initialScope: typeof NoAccess | T | undefined;
  selectedScope: typeof NoAccess | T | undefined;
  onChange: (scopes: T | typeof NoAccess) => void;
  canManageScope: boolean;
  noDowngrade?: boolean;
  possibleScope: T[];
}): React.ReactElement => {
  const initialScope = props.initialScope ?? NoAccess;

  const inner = (
    <div
      key={props.scope.name}
      className={clsx(
        'flex flex-row items-center justify-between space-x-4 py-2',
        props.canManageScope === false ? 'cursor-not-allowed opacity-50' : null,
      )}
    >
      <div>
        <div className="font-semibold text-white">{props.scope.name}</div>
        <div className="text-xs text-gray-400">{props.scope.description}</div>
      </div>
      <Select
        disabled={!props.canManageScope || props.disabled}
        value={props.selectedScope}
        onValueChange={value => {
          props.onChange(value as T | typeof NoAccess);
        }}
      >
        <SelectTrigger className="w-[150px] shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[
            { value: NoAccess, label: 'No access' },
            props.scope.mapping['read-only'] &&
              props.checkAccess(props.scope.mapping['read-only']) && {
                value: props.scope.mapping['read-only'],
                label: 'Read-only',
              },
            props.scope.mapping['read-write'] &&
              props.checkAccess(props.scope.mapping['read-write']) && {
                value: props.scope.mapping['read-write'],
                label: 'Read & write',
              },
          ]
            .filter(truthy)
            .map((item, _, all) => {
              const isDisabled =
                props.noDowngrade === true
                  ? isLowerThen(
                      item.value,
                      initialScope,
                      all.map(item => item.value),
                    )
                  : false;

              return (
                <>
                  <SelectItem key={item.value} value={item.value} disabled={isDisabled}>
                    {item.label}
                    {isDisabled ? (
                      <span className="block text-xs italic">Can't downgrade</span>
                    ) : null}
                  </SelectItem>
                </>
              );
            })}
        </SelectContent>
      </Select>
    </div>
  );

  return props.canManageScope ? (
    inner
  ) : (
    <TooltipProvider key={props.scope.name}>
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent>Your user account does not have these permissions.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

function PermissionsSpaceInner(props: Props<OrganizationAccessScope>): ReactElement<any, any>;
function PermissionsSpaceInner(props: Props<ProjectAccessScope>): ReactElement<any, any>;
function PermissionsSpaceInner(props: Props<TargetAccessScope>): ReactElement<any, any>;
function PermissionsSpaceInner<
  T extends OrganizationAccessScope | ProjectAccessScope | TargetAccessScope,
>(props: Props<T>) {
  const { scopes, initialScopes, selectedScopes, onChange, checkAccess, disabled } = props;

  return (
    <>
      {scopes.map(scope => {
        const possibleScope = [scope.mapping['read-only'], scope.mapping['read-write']].filter(
          isDefined,
        );
        const readOnlyScope = scope.mapping['read-only'];
        const hasReadOnly = typeof readOnlyScope !== 'undefined';

        return (
          <PermissionScopeItem<T>
            disabled={disabled}
            scope={scope}
            key={scope.name}
            initialScope={matchScope(
              initialScopes,
              NoAccess,
              scope.mapping['read-only'],
              scope.mapping['read-write'],
            )}
            selectedScope={matchScope(
              selectedScopes,
              NoAccess,
              scope.mapping['read-only'],
              scope.mapping['read-write'],
            )}
            checkAccess={checkAccess}
            possibleScope={possibleScope}
            canManageScope={possibleScope.some(checkAccess)}
            noDowngrade={props.noDowngrade}
            onChange={value => {
              if (value === NoAccess) {
                // Remove all possible scopes
                onChange(selectedScopes.filter(scope => !possibleScope.includes(scope)));
                return;
              }
              const isReadWrite = value === scope.mapping['read-write'];

              // Remove possible scopes
              const newScopes = selectedScopes.filter(scope => !possibleScope.includes(scope));

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
    </>
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
