import { ReactElement } from 'react';
import { Accordion } from '@chakra-ui/react';
import { useFormik } from 'formik';
import { gql, useMutation, useQuery } from 'urql';
import * as Yup from 'yup';

import { PermissionsSpace, usePermissionsManager } from '@/components/organization/Permissions';
import { Button, CopyValue, Heading, Input, Modal, Tag } from '@/components/v2';
import { OrganizationDocument, OrganizationQuery } from '@/graphql';
import { scopes } from '@/lib/access/common';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const CreateAccessToken_CreateTokenMutation = gql(/* GraphQL */ `
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

export const CreateAccessTokenModal = ({
  isOpen,
  toggleModalOpen,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
}): ReactElement => {
  const router = useRouteSelector();
  const [organizationQuery] = useQuery({
    query: OrganizationDocument,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });

  const organization = organizationQuery.data?.organization?.organization;

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen} className="w-[650px]">
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
};

const ModalContent = (props: {
  organization: Exclude<OrganizationQuery['organization'], null | undefined>['organization'];
  organizationId: string;
  projectId: string;
  targetId: string;
  toggleModalOpen: () => void;
}) => {
  const [mutation, mutate] = useMutation(CreateAccessToken_CreateTokenMutation);

  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } = useFormik({
    initialValues: { name: '' },
    validationSchema: Yup.object().shape({
      name: Yup.string().required('Must enter name'),
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
    organization: props.organization,
    member: props.organization.me,
    passMemberScopes: false,
  });

  return (
    <>
      {mutation.data?.createToken.ok ? (
        <div className="flex flex-col gap-5">
          <Heading className="text-center">Token successfully created!</Heading>
          <CopyValue value={mutation.data.createToken.ok.secret} />
          <Tag color="green">
            This is your unique API key and it is non-recoverable. If you lose this key, you will need to create a new
            one.
          </Tag>
          <Button variant="primary" size="large" className="ml-auto" onClick={props.toggleModalOpen}>
            Ok, got it!
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <Heading className="text-center">Create an access token</Heading>
          <p className="text-sm text-gray-500">
            To access GraphQL Hive, your application or tool needs an active API key.
          </p>

          <Input
            placeholder="My token"
            name="name"
            value={values.name}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isSubmitting}
            isInvalid={touched.name && Boolean(errors.name)}
            className="w-full"
          />

          {touched.name && errors.name && <div className="text-sm text-red-500">{errors.name}</div>}
          {mutation.data?.createToken.error && (
            <div className="text-sm text-red-500">{mutation.data?.createToken.error.message}</div>
          )}

          <p className="text-sm text-gray-500">
            This will be displayed on the tokens list, we recommend to make it self-explanatory.
          </p>

          <Heading>Permissions</Heading>

          <Accordion defaultIndex={0} width="100%">
            <PermissionsSpace
              title="Organization"
              scopes={scopes.organization}
              initialScopes={manager.organizationScopes}
              onChange={manager.setOrganizationScopes}
              checkAccess={manager.canAccessOrganization}
            />
            <PermissionsSpace
              title="All Projects"
              scopes={scopes.project}
              initialScopes={manager.projectScopes}
              onChange={manager.setProjectScopes}
              checkAccess={manager.canAccessProject}
            />
            <PermissionsSpace
              title="All targets"
              scopes={scopes.target}
              initialScopes={manager.targetScopes}
              onChange={manager.setTargetScopes}
              checkAccess={manager.canAccessTarget}
            />
          </Accordion>

          {mutation.error && <div className="text-sm text-red-500">{mutation.error.message}</div>}

          <div className="flex w-full gap-2">
            <Button type="button" size="large" block onClick={props.toggleModalOpen}>
              Cancel
            </Button>
            <Button type="submit" size="large" block variant="primary" disabled={isSubmitting}>
              Generate Token
            </Button>
          </div>
        </form>
      )}
    </>
  );
};
