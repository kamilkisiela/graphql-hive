import { PropsWithoutRef, ReactElement, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { PermissionsSpace, usePermissionsManager } from '@/components/organization/Permissions';
import {
  Accordion,
  Button,
  CopyValue,
  Heading,
  Input,
  Modal,
  RadixSelect,
  Tabs,
  Tag,
} from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { OrganizationAccessScope, ProjectAccessScope, TargetAccessScope } from '@/graphql';
import { scopes } from '@/lib/access/common';
import { useRouteSelector } from '@/lib/hooks';

const CreateAccessToken_CreateTokenMutation = graphql(`
  mutation CreateAccessToken_CreateToken($input: CreateTokenInput!) {
    createToken(input: $input) {
      ok {
        selector {
          organization
          project
          target
        }
        createdToken {
          ...TokenFields
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
    <Modal
      open={isOpen}
      onOpenChange={toggleModalOpen}
      className="w-[650px] h-5/6 flex overflow-hidden"
    >
      {organization ? (
        <ModalContent
          organization={organization}
          organizationId={router.organizationId}
          projectId={router.projectId}
          targetId={router.targetId}
          toggleModalOpen={toggleModalOpen}
        />
      ) : null}
    </Modal>
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

type TokenPreset = {
  name: string;
  description: string | ReactElement;
  permissions: {
    target: Set<TargetAccessScope>;
    project: Set<ProjectAccessScope>;
    organization: Set<OrganizationAccessScope>;
  };
};

const TOKEN_SIMPLE_PRESETS: TokenPreset[] = [
  {
    name: 'Schema Check & Push',
    description:
      'This set of permissions allows the token to check new schemas, push schemas, and report GraphQL operations usage.',
    permissions: {
      target: new Set([
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
      ]),
      project: new Set(),
      organization: new Set(),
    },
  },
  {
    name: 'Schema Check Only',
    description:
      'This set of permissions allows the token to check new schemas. You can use this kind of token as part if your continuous integration pipeline.',
    permissions: {
      target: new Set([
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryRead,
      ]),
      project: new Set(),
      organization: new Set(),
    },
  },
  {
    name: 'GraphQL Operations Reporting',
    description:
      'This set of permissions allows the token to check new schemas, push schemas, and report GraphQL operations usage.',
    permissions: {
      target: new Set([
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
      ]),
      project: new Set(),
      organization: new Set(),
    },
  },
  {
    name: 'Full Access',
    description: 'A token with all permissions. Use with caution.',
    permissions: {
      target: new Set([
        TargetAccessScope.Delete,
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
        TargetAccessScope.TokensRead,
        TargetAccessScope.TokensWrite,
      ]),
      project: new Set([
        ProjectAccessScope.OperationsStoreWrite,
        ProjectAccessScope.OperationsStoreRead,
        ProjectAccessScope.Settings,
        ProjectAccessScope.Alerts,
        ProjectAccessScope.Delete,
        ProjectAccessScope.Read,
      ]),
      organization: new Set([
        OrganizationAccessScope.Integrations,
        OrganizationAccessScope.Settings,
        OrganizationAccessScope.Members,
        OrganizationAccessScope.Delete,
        OrganizationAccessScope.Read,
      ]),
    },
  },
];

const TokenPresetSelect = (
  props: PropsWithoutRef<{
    setSelectedPreset: (preset: string) => void;
    activePreset: TokenPreset | null;
  }>,
): ReactElement => {
  return (
    <div className="mt-3">
      <RadixSelect
        placeholder="Select a preset"
        name="preset-select"
        position="popper"
        value={props.activePreset?.name}
        options={TOKEN_SIMPLE_PRESETS.map(preset => ({ value: preset.name, label: preset.name }))}
        onChange={value => {
          props.setSelectedPreset(value);
        }}
      />
      {props.activePreset ? (
        <p className="mt-4 text-sm text-gray-500">{props.activePreset.description}</p>
      ) : null}
    </div>
  );
};

const PresetTabContent = (props: { manager: ReturnType<typeof usePermissionsManager> }) => {
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined);
  const activePreset =
    (selectedPreset && TOKEN_SIMPLE_PRESETS.find(v => v.name === selectedPreset)) || null;

  const isPermissionMismatch = useMemo(() => {
    if (activePreset == null) {
      return false;
    }
    return (
      !props.manager.targetScopes.every(scope => props.manager.canAccessTarget(scope)) ||
      !props.manager.projectScopes.every(scope => props.manager.canAccessProject(scope)) ||
      !props.manager.organizationScopes.every(scope => props.manager.canAccessOrganization(scope))
    );
  }, [props.manager]);

  return (
    <>
      <div className="px-4 pb-2 text-sm">
        <p className=" text-gray-500">
          With simple mode, you can choose the flow you want to implement and the wizard will help
          you with the permissions required.
        </p>
        <TokenPresetSelect
          activePreset={activePreset}
          setSelectedPreset={presetName => {
            const preset = TOKEN_SIMPLE_PRESETS.find(v => v.name === presetName) ?? null;
            if (preset == null) {
              return;
            }

            props.manager.setTargetScopes(Array.from(preset.permissions.target));
            props.manager.setProjectScopes(Array.from(preset.permissions.project));
            props.manager.setOrganizationScopes(Array.from(preset.permissions.organization));
            setSelectedPreset(preset.name);
          }}
        />
        {isPermissionMismatch ? (
          <div
            className={clsx(
              'mt-6 flex items-center rounded-lg border py-2 px-4 gap-4',
              'border-red-200 bg-red-100 text-red-900 dark:border-red-200/30 dark:bg-red-900/30 dark:text-red-200',
            )}
          >
            <div className="w-full min-w-0">
              Your user account does not satisfy all the selected permissions included in this
              preset. You can still create an access token preset, but the permissions will be
              omitted. Check the list below for more information.
            </div>
          </div>
        ) : null}
      </div>
      <Accordion type="multiple" defaultValue={['Organization', 'Project', 'Target']}>
        <PermissionsSpace
          title="Organization"
          scopes={scopes.organization}
          initialScopes={props.manager.organizationScopes}
          onChange={props.manager.setOrganizationScopes}
          checkAccess={props.manager.canAccessOrganization}
          isReadOnly
        />
        <PermissionsSpace
          title="Project"
          scopes={scopes.project}
          initialScopes={props.manager.projectScopes}
          onChange={props.manager.setProjectScopes}
          checkAccess={props.manager.canAccessProject}
          isReadOnly
        />
        <PermissionsSpace
          title="Target"
          scopes={scopes.target}
          initialScopes={props.manager.targetScopes}
          onChange={props.manager.setTargetScopes}
          checkAccess={props.manager.canAccessTarget}
          isReadOnly
        />
      </Accordion>
    </>
  );
};

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
  const [mutation, mutate] = useMutation(CreateAccessToken_CreateTokenMutation);

  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } =
    useFormik({
      initialValues: { name: '' },
      validationSchema: Yup.object().shape({
        name: Yup.string().required('Must enter description'),
      }),
      async onSubmit(values) {
        await mutate({
          input: {
            organization: props.organizationId,
            project: props.projectId,
            target: props.targetId,
            name: values.name,
            organizationScopes: manager.organizationScopes.filter(manager.canAccessOrganization),
            projectScopes: manager.projectScopes.filter(manager.canAccessProject),
            targetScopes: manager.targetScopes.filter(manager.canAccessTarget),
          },
        });
      },
    });

  const manager = usePermissionsManager({
    onSuccess() {},
    organization,
    member: organization.me,
    passMemberScopes: false,
  });

  console.log(manager);

  const noPermissionsSelected =
    manager.organizationScopes.length === 0 &&
    manager.projectScopes.length === 0 &&
    manager.targetScopes.length === 0;

  return (
    <>
      {mutation.data?.createToken.ok ? (
        <div className="flex flex-col gap-5 grow">
          <Heading className="text-center">Token successfully created!</Heading>
          <CopyValue value={mutation.data.createToken.ok.secret} />
          <Tag color="green">
            This is your unique API key and it is non-recoverable. If you lose this key, you will
            need to create a new one.
          </Tag>
          <div className="grow" />
          <Button
            variant="primary"
            size="large"
            className="ml-auto"
            onClick={props.toggleModalOpen}
          >
            Ok, got it!
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-5 grow" onSubmit={handleSubmit}>
          <div className="shrink-0">
            <div className="flex-none">
              <Heading className="text-center mb-2">Create an access token</Heading>
              <p className="text-sm text-gray-500 mb-2">
                To access GraphQL Hive, your application or tool needs an active API key.
              </p>

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
              <div className="text-sm text-red-500 mt-2">{errors.name}</div>
            )}
            {mutation.data?.createToken.error && (
              <div className="text-sm text-red-500 mt-2">
                {mutation.data?.createToken.error.message}
              </div>
            )}
          </div>
          <div className="container flex flex-col flex-1 overflow-hidden">
            <Tabs
              defaultValue="simple"
              className="flex flex-col overflow-hidden"
              onValueChange={value => {
                if (value === 'simple') {
                  manager.setOrganizationScopes([]);
                  manager.setProjectScopes([]);
                  manager.setTargetScopes([]);
                }
                if (value === 'advanced') {
                  manager.setOrganizationScopes(scopes =>
                    scopes.filter(manager.canAccessOrganization),
                  );
                  manager.setProjectScopes(scopes => scopes.filter(manager.canAccessProject));
                  manager.setTargetScopes(scopes => scopes.filter(manager.canAccessTarget));
                }
              }}
            >
              <Tabs.List>
                <Tabs.Trigger value="simple" asChild>
                  <div>Simple</div>
                </Tabs.Trigger>
                <Tabs.Trigger value="advanced" asChild>
                  <div>Advanced</div>
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="simple" className="flex py-2 overflow-hidden relative" noPadding>
                <div className="overflow-y-scroll py-7">
                  <PresetTabContent manager={manager} />
                </div>
                <ScrollableTabShadow />
              </Tabs.Content>
              <Tabs.Content value="advanced" noPadding className="flex relative">
                <div className="overflow-y-scroll py-7">
                  <Accordion type="multiple" defaultValue={['Organization', 'Project', 'Target']}>
                    <PermissionsSpace
                      title="Organization"
                      scopes={scopes.organization}
                      initialScopes={manager.organizationScopes}
                      onChange={manager.setOrganizationScopes}
                      checkAccess={manager.canAccessOrganization}
                    />
                    <PermissionsSpace
                      title="Project"
                      scopes={scopes.project}
                      initialScopes={manager.projectScopes}
                      onChange={manager.setProjectScopes}
                      checkAccess={manager.canAccessProject}
                    />
                    <PermissionsSpace
                      title="Target"
                      scopes={scopes.target}
                      initialScopes={manager.targetScopes}
                      onChange={manager.setTargetScopes}
                      checkAccess={manager.canAccessTarget}
                    />
                  </Accordion>
                </div>
                <ScrollableTabShadow />
              </Tabs.Content>
            </Tabs>
          </div>
          <div className="shrink-0">
            {mutation.error && <div className="text-sm text-red-500">{mutation.error.message}</div>}

            <div className="flex w-full gap-2">
              <Button type="button" size="large" block onClick={props.toggleModalOpen}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="large"
                block
                variant="primary"
                disabled={isSubmitting || noPermissionsSelected}
              >
                Generate Token
              </Button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}

const ScrollableTabShadow = () => (
  <div
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      boxShadow: 'inset 0px 20px 20px -10px black, inset 0px -20px 20px -10px black',
    }}
  />
);
