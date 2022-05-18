import React from 'react';
import 'twin.macro';
import { useMutation } from 'urql';
import {
  Select,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
} from '@chakra-ui/react';
import {
  MemberFieldsFragment,
  OrganizationFieldsFragment,
  UpdateOrganizationMemberAccessDocument,
  OrganizationAccessScope,
  ProjectAccessScope,
  TargetAccessScope,
} from '@/graphql';
import { Scope, NoAccess } from '@/lib/access/common';
import { canAccessOrganization } from '@/lib/access/organization';
import { canAccessProject } from '@/lib/access/project';
import { canAccessTarget } from '@/lib/access/target';
import { useNotifications } from '@/lib/hooks/use-notifications';

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
  higherPriority?: T
) {
  let hasHigher = false;
  let hasLower = false;

  list.forEach((item) => {
    if (item === higherPriority) {
      hasHigher = true;
    } else if (item === lowerPriority) {
      hasLower = true;
    }
  });

  if (hasHigher) {
    return higherPriority;
  }

  if (hasLower) {
    return lowerPriority;
  }

  return defaultValue;
}

function PermissionsSpaceInner(
  props: Props<OrganizationAccessScope>
): React.ReactElement<any, any>;
function PermissionsSpaceInner(
  props: Props<ProjectAccessScope>
): React.ReactElement<any, any>;
function PermissionsSpaceInner(
  props: Props<TargetAccessScope>
): React.ReactElement<any, any>;
function PermissionsSpaceInner<
  T extends OrganizationAccessScope | ProjectAccessScope | TargetAccessScope
>(props: Props<T>) {
  const { title, scopes, initialScopes, onChange, checkAccess } = props;

  return (
    <AccordionItem>
      <AccordionButton tw="font-bold">{title}</AccordionButton>
      <AccordionPanel pb={4}>
        <div tw="divide-y-2 divide-gray-100">
          {scopes.map((scope) => {
            const possibleScope = [
              scope.mapping['read-only'],
              scope.mapping['read-write'],
            ].filter(Boolean);
            const canManageScope = possibleScope.some(checkAccess);

            if (!canManageScope) {
              return null;
            }

            const hasReadOnly = !!scope.mapping['read-only'];
            const selectedScope = matchScope(
              initialScopes,
              NoAccess,
              scope.mapping['read-only'],
              scope.mapping['read-write']
            );

            return (
              <div
                tw="py-2 flex flex-row justify-between items-center"
                key={scope.name}
              >
                <div>
                  <div tw="font-semibold text-gray-600">{scope.name}</div>
                  <div tw="text-xs text-gray-600">{scope.description}</div>
                </div>
                <div>
                  <Select
                    size="sm"
                    value={selectedScope}
                    onChange={(event) => {
                      const value = event.target.value as T | string;

                      if (value === NoAccess) {
                        // Remove all posible scopes
                        onChange(
                          initialScopes.filter(
                            (scope) => !possibleScope.includes(scope)
                          )
                        );
                      } else {
                        const isReadWrite =
                          value === scope.mapping['read-write'];

                        // Remove possible scopes
                        const newScopes = initialScopes.filter(
                          (scope) => !possibleScope.includes(scope)
                        );

                        if (isReadWrite) {
                          newScopes.push(scope.mapping['read-write']);

                          if (hasReadOnly) {
                            // Include read-only as well
                            newScopes.push(scope.mapping['read-only']);
                          }
                        } else {
                          // just read-only
                          newScopes.push(scope.mapping['read-only']);
                        }

                        onChange(newScopes);
                      }
                    }}
                  >
                    <option value={NoAccess}>No access</option>
                    {scope.mapping['read-only'] &&
                      checkAccess(scope.mapping['read-only']) && (
                        <option value={scope.mapping['read-only']}>
                          Read-only
                        </option>
                      )}
                    {scope.mapping['read-write'] &&
                      checkAccess(scope.mapping['read-write']) && (
                        <option value={scope.mapping['read-write']}>
                          Read &amp; write
                        </option>
                      )}
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      </AccordionPanel>
    </AccordionItem>
  );
}

export const PermissionsSpace = React.memo(
  PermissionsSpaceInner
) as unknown as typeof PermissionsSpaceInner;

export function usePermissionsManager({
  organization,
  member,
  onSuccess,
}: {
  organization: OrganizationFieldsFragment;
  member: MemberFieldsFragment;
  onSuccess(): void;
}) {
  const [state, setState] = React.useState<'LOADING' | 'IDLE'>('IDLE');
  const notify = useNotifications();
  const [, mutate] = useMutation(UpdateOrganizationMemberAccessDocument);

  const [targetScopes, setTargetScopes] = React.useState(
    member.targetAccessScopes
  );

  const [projectScopes, setProjectScopes] = React.useState(
    member.projectAccessScopes
  );

  const [organizationScopes, setOrganizationScopes] = React.useState(
    member.organizationAccessScopes
  );

  const submit = React.useCallback(
    (evt) => {
      evt.preventDefault();
      setState('LOADING');
      mutate({
        input: {
          organization: organization.cleanId,
          user: member.id,
          targetScopes,
          projectScopes,
          organizationScopes,
        },
      }).then((result) => {
        setState('IDLE');
        if (result.error) {
          notify(
            `Failed to change access (reason: ${result.error.message}`,
            'error'
          );
        } else {
          onSuccess();
          notify('Member access saved', 'success');
        }
      });
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
    ]
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
    // Methods
    canAccessOrganization: React.useCallback(
      (scope: OrganizationAccessScope) =>
        canAccessOrganization(scope, organization.me),
      [organization]
    ),
    canAccessProject: React.useCallback(
      (scope: ProjectAccessScope) => canAccessProject(scope, organization.me),
      [organization]
    ),
    canAccessTarget: React.useCallback(
      (scope: TargetAccessScope) => canAccessTarget(scope, organization.me),
      [organization]
    ),
  };
}
