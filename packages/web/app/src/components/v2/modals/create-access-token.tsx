import { ReactElement, useCallback, useRef, useState } from 'react';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { PermissionScopeItem, usePermissionsManager } from '@/components/organization/Permissions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { CopyValue, Input, Tag } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { TargetAccessScope } from '@/gql/graphql';
import { RegistryAccessScope, UsageAccessScope } from '@/lib/access/common';
import { useRouteSelector } from '@/lib/hooks';

export const CreateAccessToken_CreateTokenMutation = graphql(`
  mutation CreateAccessToken_CreateToken($input: CreateTokenInput!) {
    createToken(input: $input) {
      ok {
        selector {
          organization
          project
          target
        }
        createdToken {
          id
          name
          alias
          date
          lastUsedAt
        }
        secret
      }
      error {
        message
      }
    }
  }
`);

const CreateAccessTokenModalQuery = graphql(`
  query CreateAccessTokenModalQuery($organizationId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        ...CreateAccessTokenModalContent_OrganizationFragment
      }
    }
  }
`);

export function CreateAccessTokenModal({
  isOpen,
  toggleModalOpen,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
}): ReactElement {
  const router = useRouteSelector();
  const [organizationQuery] = useQuery({
    query: CreateAccessTokenModalQuery,
    variables: {
      organizationId: router.organizationId,
    },
  });

  const organization = organizationQuery.data?.organization?.organization;

  return (
    <Dialog open={isOpen} onOpenChange={toggleModalOpen}>
      {organization ? (
        <ModalContent
          organization={organization}
          organizationId={router.organizationId}
          projectId={router.projectId}
          targetId={router.targetId}
          toggleModalOpen={toggleModalOpen}
        />
      ) : null}
    </Dialog>
  );
}

const CreateAccessTokenModalContent_OrganizationFragment = graphql(`
  fragment CreateAccessTokenModalContent_OrganizationFragment on Organization {
    id
    ...UsePermissionManager_OrganizationFragment
    me {
      ...UsePermissionManager_MemberFragment
    }
  }
`);

function getFinalTargetAccessScopes(
  selectedRegistryScope: 'no-access' | TargetAccessScope,
  selectedUsageScope: 'no-access' | TargetAccessScope,
): TargetAccessScope[] {
  const scopes: TargetAccessScope[] = [];

  if (selectedRegistryScope !== 'no-access') {
    // When :write got selected, we also need to provide :read
    if (selectedRegistryScope === TargetAccessScope.RegistryWrite) {
      scopes.push(TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite);
    } else {
      scopes.push(TargetAccessScope.RegistryRead);
    }
  }

  if (selectedUsageScope !== 'no-access') {
    // When :write got selected, we also need to provide :read
    if (selectedUsageScope === TargetAccessScope.UsageWrite) {
      scopes.push(TargetAccessScope.UsageRead, TargetAccessScope.UsageWrite);
    } else {
      scopes.push(TargetAccessScope.UsageRead);
    }
  }

  return scopes;
}

function PresetOption(props: { value: string; name: string; description: string }) {
  return (
    <SelectItem value={props.value}>
      <div className="flex items-start gap-3">
        <div className="grid gap-0.5">
          <p>{props.name}</p>
          <p className="text-muted-foreground text-xs" data-description>
            {props.description}
          </p>
        </div>
      </div>
    </SelectItem>
  );
}

function Presets(props: {
  selected: string | undefined;
  onSelected: (
    event: {
      value: string;
      usageScope: TargetAccessScope | 'no-access';
      registryScope: TargetAccessScope | 'no-access';
    } | null,
  ) => void;
}) {
  const key = useRef(0);
  const previousSelected = useRef<string | undefined>();

  if (previousSelected.current === undefined) {
    previousSelected.current = props.selected;
  }

  // Every time the selected value changes, we increment the key
  // We do it to reset the select component and make it show the placeholder
  if (key.current >= 0 && previousSelected.current !== props.selected) {
    key.current += 1;
    previousSelected.current = props.selected;
  }

  return (
    <Select
      key={key.current}
      value={props.selected}
      onValueChange={value => {
        if (value === 'usage-reporting') {
          props.onSelected({
            value,
            usageScope: TargetAccessScope.UsageRead,
            registryScope: TargetAccessScope.RegistryRead,
          });
        } else if (value === 'schema-push') {
          props.onSelected({
            value,
            usageScope: TargetAccessScope.UsageRead,
            registryScope: TargetAccessScope.RegistryWrite,
          });
        } else if (value === 'schema-check') {
          props.onSelected({
            value,
            usageScope: TargetAccessScope.UsageRead,
            registryScope: TargetAccessScope.RegistryRead,
          });
        } else {
          props.onSelected(null);
        }
      }}
    >
      <SelectTrigger className="items-start [&_[data-description]]:hidden">
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        <PresetOption
          value="usage-reporting"
          name="Usage Reporting and Monitoring"
          description="Collect usage data and monitor performance of your GraphQL API"
        />
        <PresetOption
          value="schema-push"
          name="Updating Schema Registry"
          description="Use Hive CLI (schema:publish, schema:delete) to push your schema to the registry"
        />
        <PresetOption
          value="schema-check"
          name="Checking Schema"
          description="Use Hive CLI (schema:check) to detect changes and validate your schema"
        />
        <PresetOption
          value="schema-check"
          name="Reading from Schema Registry"
          description="Consume schema and its metadata from the registry"
        />
      </SelectContent>
    </Select>
  );
}

function ModalContent(props: {
  organization: FragmentType<typeof CreateAccessTokenModalContent_OrganizationFragment>;
  organizationId: string;
  projectId: string;
  targetId: string;
  toggleModalOpen: () => void;
}): ReactElement {
  const organization = useFragment(
    CreateAccessTokenModalContent_OrganizationFragment,
    props.organization,
  );
  const [selectedRegistryScope, setSelectedRegistryScope] = useState(
    'no-access' as TargetAccessScope | 'no-access',
  );
  const [selectedUsageScope, setSelectedUsageScope] = useState(
    'no-access' as TargetAccessScope | 'no-access',
  );

  const manager = usePermissionsManager({
    onSuccess() {},
    organization,
    member: organization.me,
    passMemberScopes: false,
  });

  const [selectedPreset, setSelectedPreset] = useState<
    | {
        value: string;
        usageScope: TargetAccessScope | 'no-access' | null;
        registryScope: TargetAccessScope | 'no-access' | null;
      }
    | undefined
  >();
  const onSelectedPreset = useCallback(
    (
      event: {
        value: string;
        usageScope: TargetAccessScope | 'no-access';
        registryScope: TargetAccessScope | 'no-access';
      } | null,
    ) => {
      if (event === null) {
        setSelectedPreset(undefined);
        return;
      }

      setSelectedPreset(event);
      setSelectedUsageScope(event.usageScope);
      setSelectedRegistryScope(event.registryScope);
    },
    [setSelectedPreset, setSelectedUsageScope, setSelectedRegistryScope],
  );

  const [mutation, mutate] = useMutation(CreateAccessToken_CreateTokenMutation);
  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } =
    useFormik({
      initialValues: { name: '' },
      validationSchema: Yup.object().shape({
        name: Yup.string().required('Description is required. It helps you identify the token.'),
      }),
      async onSubmit(values) {
        await mutate({
          input: {
            organization: props.organizationId,
            project: props.projectId,
            target: props.targetId,
            name: values.name,
            organizationScopes: [],
            projectScopes: [],
            targetScopes: getFinalTargetAccessScopes(selectedRegistryScope, selectedUsageScope),
          },
        });
      },
    });

  const noPermissionsSelected =
    selectedRegistryScope === 'no-access' && selectedUsageScope === 'no-access';

  return (
    <DialogContent className="w-[650px]">
      {mutation.data?.createToken.ok ? (
        <>
          <DialogHeader>
            <DialogTitle>Token successfully created!</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <CopyValue value={mutation.data.createToken.ok.secret} />
            <Tag color="green">
              This is your unique API key and it is non-recoverable. If you lose this key, you will
              need to create a new one.
            </Tag>
          </div>
          <DialogFooter className="text-right">
            <Button onClick={props.toggleModalOpen}>Ok, got it!</Button>
          </DialogFooter>
        </>
      ) : (
        <>
          <DialogHeader>
            <DialogTitle>Create an access token</DialogTitle>
            <DialogDescription>
              To access GraphQL Hive, your application or tool needs an active API key.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <div>
                <Input
                  placeholder="Token description"
                  name="name"
                  value={values.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={isSubmitting}
                  isInvalid={touched.name && !!errors.name}
                  className="w-full"
                />
              </div>
              {touched.name && errors.name && (
                <div className="mt-2 text-sm text-red-500">{errors.name}</div>
              )}
              {mutation.data?.createToken.error && (
                <div className="mt-2 text-sm text-red-500">
                  {mutation.data?.createToken.error.message}
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <PermissionScopeItem
                scope={RegistryAccessScope}
                canManageScope={
                  manager.canAccessTarget(RegistryAccessScope.mapping['read-only']) ||
                  manager.canAccessTarget(RegistryAccessScope.mapping['read-write'])
                }
                checkAccess={manager.canAccessTarget}
                onChange={value => {
                  if (value !== selectedPreset?.registryScope) {
                    setSelectedPreset(undefined);
                  }

                  if (value === 'no-access') {
                    setSelectedRegistryScope('no-access');
                    return;
                  }
                  setSelectedRegistryScope(value);
                }}
                possibleScope={Object.values(RegistryAccessScope.mapping)}
                initialScope={selectedRegistryScope}
                selectedScope={selectedRegistryScope}
              />
              <PermissionScopeItem
                scope={UsageAccessScope}
                canManageScope={
                  manager.canAccessTarget(UsageAccessScope.mapping['read-only']) ||
                  manager.canAccessTarget(UsageAccessScope.mapping['read-write'])
                }
                checkAccess={manager.canAccessTarget}
                onChange={value => {
                  if (value !== selectedPreset?.registryScope) {
                    setSelectedPreset(undefined);
                  }

                  if (value === 'no-access') {
                    setSelectedUsageScope('no-access');
                    return;
                  }
                  setSelectedUsageScope(value);
                }}
                possibleScope={Object.values(UsageAccessScope.mapping)}
                initialScope={selectedUsageScope}
                selectedScope={selectedUsageScope}
              />
            </div>
            <div className="my-4 flex flex-row items-center justify-between">
              <Separator className="shrink" />
              <div className="text-muted-foreground shrink-0 px-4">or</div>
              <Separator className="shrink" />
            </div>
            <div>
              <Presets selected={selectedPreset?.value} onSelected={onSelectedPreset} />
            </div>
            <DialogFooter>
              {mutation.error && (
                <div className="text-sm text-red-500">{mutation.error.message}</div>
              )}

              <div className="space-x-2 text-right">
                <Button
                  variant="secondary"
                  disabled={isSubmitting}
                  type="button"
                  onClick={props.toggleModalOpen}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || noPermissionsSelected}>
                  Generate Token
                </Button>
              </div>
            </DialogFooter>
          </form>
        </>
      )}
    </DialogContent>
  );
}
