import { PropsWithoutRef, ReactElement, useState } from 'react';
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
    <Modal open={isOpen} onOpenChange={toggleModalOpen} className="w-[800px] h-5/6 flex">
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
    target: TargetAccessScope[];
    project: ProjectAccessScope[];
    organization: OrganizationAccessScope[];
  };
};

const TOKEN_SIMPLE_PRESETS: TokenPreset[] = [
  {
    name: 'Schema Check & Push',
    description:
      'This set of permissions allows the token to check new schemas, push schemas, and report GraphQL operations usage.',
    permissions: {
      target: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
      ],
      project: [],
      organization: [],
    },
  },
  {
    name: 'Schema Check Only',
    description:
      'This set of permissions allows the token to check new schemas. You can use this kind of token as part if your continuous integration pipeline.',
    permissions: {
      target: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryRead,
      ],
      project: [],
      organization: [],
    },
  },
  {
    name: 'GraphQL Operations Reporting',
    description:
      'This set of permissions allows the token to check new schemas, push schemas, and report GraphQL operations usage.',
    permissions: {
      target: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
      ],
      project: [],
      organization: [],
    },
  },
  {
    name: 'Full Access',
    description: 'A token with all permissions. Use with caution.',
    permissions: {
      target: [
        TargetAccessScope.Delete,
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
        TargetAccessScope.TokensRead,
        TargetAccessScope.TokensWrite,
      ],
      project: [
        ProjectAccessScope.OperationsStoreWrite,
        ProjectAccessScope.OperationsStoreRead,
        ProjectAccessScope.Settings,
        ProjectAccessScope.Alerts,
        ProjectAccessScope.Delete,
        ProjectAccessScope.Read,
      ],
      organization: [
        OrganizationAccessScope.Integrations,
        OrganizationAccessScope.Settings,
        OrganizationAccessScope.Members,
        OrganizationAccessScope.Delete,
        OrganizationAccessScope.Read,
      ],
    },
  },
];

const TokenPresetSelect = (
  props: PropsWithoutRef<{
    onPresetChange: (preset: TokenPreset) => void;
  }>,
): ReactElement => {
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined);
  const activePreset = selectedPreset
    ? TOKEN_SIMPLE_PRESETS.find(v => v.name === selectedPreset)
    : null;

  return (
    <div className="mt-3">
      <RadixSelect
        placeholder="Select a preset"
        name="preset-select"
        position="popper"
        value={selectedPreset}
        options={TOKEN_SIMPLE_PRESETS.map(preset => ({ value: preset.name, label: preset.name }))}
        onChange={value => {
          setSelectedPreset(value);
          props.onPresetChange(TOKEN_SIMPLE_PRESETS.find(v => v.name === value)!);
        }}
      />
      {activePreset ? (
        <p className="mt-4 text-sm text-gray-500">{activePreset.description}</p>
      ) : null}
    </div>
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
            organizationScopes: manager.organizationScopes,
            projectScopes: manager.projectScopes,
            targetScopes: manager.targetScopes,
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
          <Heading className="text-center">Create an access token</Heading>
          <p className="text-sm text-gray-500">
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

          {touched.name && errors.name && <div className="text-sm text-red-500">{errors.name}</div>}
          {mutation.data?.createToken.error && (
            <div className="text-sm text-red-500">{mutation.data?.createToken.error.message}</div>
          )}

          <Tabs
            className="container flex h-full grow flex-col cursor-pointer"
            defaultValue="simple"
          >
            <Tabs.List>
              <Tabs.Trigger value="simple" asChild>
                <div>Simple</div>
              </Tabs.Trigger>
              <Tabs.Trigger value="advanced" asChild>
                <div>Advanced</div>
              </Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="simple">
              <p className="text-sm text-gray-500">
                With simple mode, you can choose the flow you want to implement and the wizard will
                help you with the permissions required:
              </p>
              <TokenPresetSelect
                onPresetChange={preset => {
                  manager.setTargetScopes(preset.permissions.target);
                  manager.setProjectScopes(preset.permissions.project);
                  manager.setOrganizationScopes(preset.permissions.organization);
                }}
              />
            </Tabs.Content>
            <Tabs.Content value="advanced">
              <Accordion>
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
            </Tabs.Content>
          </Tabs>

          {mutation.error && <div className="text-sm text-red-500">{mutation.error.message}</div>}

          <div className="flex w-full gap-2 pb-2">
            <Button type="button" size="large" block onClick={props.toggleModalOpen}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="large"
              block
              variant="primary"
              disabled={isSubmitting || manager.noneSelected}
            >
              Generate Token
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
