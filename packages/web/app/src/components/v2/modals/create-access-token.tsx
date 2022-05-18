import { ReactElement } from 'react';
import { Accordion } from '@chakra-ui/react';
import { useFormik } from 'formik';
import { useMutation } from 'urql';
import * as Yup from 'yup';

import {
  PermissionsSpace,
  usePermissionsManager,
} from '@/components/organization/Permissions';
import { Button, CopyValue, Heading, Input, Modal, Tag } from '@/components/v2';
import { CreateTokenDocument, OrganizationFieldsFragment } from '@/graphql';
import { scopes } from '@/lib/access/common';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

export const CreateAccessTokenModal = ({
  isOpen,
  toggleModalOpen,
  organization,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organization: OrganizationFieldsFragment;
}): ReactElement => {
  const router = useRouteSelector();

  const [mutation, mutate] = useMutation(CreateTokenDocument);

  const {
    handleSubmit,
    values,
    handleChange,
    handleBlur,
    isSubmitting,
    errors,
    touched,
  } = useFormik({
    initialValues: { name: '' },
    validationSchema: Yup.object().shape({
      name: Yup.string().required('Must enter name'),
    }),
    async onSubmit(values) {
      await mutate({
        input: {
          organization: router.organizationId,
          project: router.projectId,
          target: router.targetId,
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
  });

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen} className="w-[650px]">
      {mutation.data ? (
        <div className="flex flex-col gap-5">
          <Heading className="text-center">Token successfully created!</Heading>
          <CopyValue value={mutation.data.createToken.secret} />
          <Tag color="green">
            This is your unique API key and it is non-recoverable. If you lose
            this key, you will need to create a new one.
          </Tag>
          <Button
            variant="primary"
            size="large"
            className="ml-auto"
            onClick={toggleModalOpen}
          >
            Ok, got it!
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <Heading className="text-center">Create an access token</Heading>
          <p className="text-sm text-gray-500">
            To access GraphQL Hive, your application or tool needs an active API
            key.
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

          {touched.name && errors.name && (
            <div className="text-sm text-red-500">{errors.name}</div>
          )}

          <p className="text-sm text-gray-500">
            This will be displayed on the tokens list, we recommend to make it
            self-explanatory.
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

          {mutation.error && (
            <div className="text-sm text-red-500">{mutation.error.message}</div>
          )}

          <div className="flex w-full gap-2">
            <Button type="button" size="large" block onClick={toggleModalOpen}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="large"
              block
              variant="primary"
              disabled={isSubmitting}
            >
              Generate Token
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
