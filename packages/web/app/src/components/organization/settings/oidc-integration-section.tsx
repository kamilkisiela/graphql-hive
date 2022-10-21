import { Button, Input, Modal } from '@/components/v2';
import { Heading } from '@chakra-ui/react';
import { useFormik } from 'formik';
import { useRouter } from 'next/router';
import { ReactElement } from 'react';

import { gql, DocumentType, useMutation } from 'urql';

const OIDCIntegrationSection_OrganizationFragment = gql(/* GraphQL */ `
  fragment OIDCIntegrationSection_OrganizationFragment on Organization {
    id
    oidcIntegration {
      id
      ...UpdateOIDCIntegration_OIDCIntegrationFragment
    }
  }
`);

export const OIDCIntegrationSection = (props: {
  organization: DocumentType<typeof OIDCIntegrationSection_OrganizationFragment>;
}): ReactElement => {
  const router = useRouter();

  const isCreateOIDCIntegrationModalOpen = router.asPath.endsWith('#create-oidc-integration');
  const isUpdateOIDCIntegrationModalOpen = router.asPath.endsWith('#update-oidc-integration');
  const isDeleteOIDCIntegrationModalOpen = router.asPath.endsWith('#delete-oidc-integration');

  const closeModal = () => {
    router.push(router.asPath.split('#')[0]);
  };

  const openCreateModalLink = `${router.asPath}#create-oidc-integration`;
  const openEditModalLink = `${router.asPath}#update-oidc-integration`;
  const openDeleteModalLink = `${router.asPath}#delete-oidc-integration`;

  console.log(router.asPath.split('#')[0] + '#update-oidc-integration');

  return (
    <>
      <Heading>OpenID Connect Provider</Heading>
      {props.organization.oidcIntegration ? (
        <>
          <Button
            as="a"
            href={openEditModalLink}
            onClick={() => {
              router.push(openEditModalLink);
            }}
          >
            Configure
          </Button>
          <Button
            danger
            as="a"
            href={openDeleteModalLink}
            onClick={() => {
              router.push(openDeleteModalLink);
            }}
          >
            Remove
          </Button>
        </>
      ) : (
        <Button
          as="a"
          href={openCreateModalLink}
          onClick={() => {
            router.push(openCreateModalLink);
          }}
        >
          Connect
        </Button>
      )}
      <CreateOIDCIntegrationModal
        isOpen={isCreateOIDCIntegrationModalOpen}
        close={closeModal}
        hasOIDCIntegration={!!props.organization.oidcIntegration}
        organizationId={props.organization.id}
        openEditModalLink={openEditModalLink}
      />
      <UpdateOIDCIntegrationModal
        key={props.organization.oidcIntegration?.id ?? 'noop'}
        oidcIntegration={props.organization.oidcIntegration ?? null}
        isOpen={isUpdateOIDCIntegrationModalOpen}
        close={closeModal}
        openCreateModalLink={openCreateModalLink}
      />
      <DeleteOIDCIntegrationModal
        key={props.organization.oidcIntegration?.id ?? 'noop'}
        isOpen={isDeleteOIDCIntegrationModalOpen}
        close={closeModal}
        oidcIntegrationId={props.organization.oidcIntegration?.id ?? null}
      />
    </>
  );
};

const CreateOIDCIntegrationModal_CreateOIDCIntegrationMutation = gql(/* GraphQL */ `
  mutation CreateOIDCIntegrationModal_CreateOIDCIntegrationMutation($input: CreateOIDCIntegrationInput!) {
    createOIDCIntegration(input: $input) {
      ok {
        organization {
          ...OIDCIntegrationSection_OrganizationFragment
        }
      }
      error {
        message
        details {
          clientId
          clientSecret
          domain
        }
      }
    }
  }
`);

const CreateOIDCIntegrationModal = (props: {
  isOpen: boolean;
  close: () => void;
  hasOIDCIntegration: boolean;
  organizationId: string;
  openEditModalLink: string;
}): ReactElement => {
  return (
    <Modal open={props.isOpen} onOpenChange={props.close} className="w-[800px]">
      {props.hasOIDCIntegration === true ? (
        <div className="flex flex-col items-center gap-5">
          <Heading>Create OpenID Connect Integration</Heading>
          <p>
            You are trying to create an OpenID Connect integration for an organization that already has a provider
            attached. Please instead configure the existing provider.
          </p>
          <div className="flex w-full gap-2">
            <Button type="button" size="large" block onClick={props.close}>
              Close
            </Button>
            <Button type="submit" size="large" block variant="primary" href={props.openEditModalLink}>
              Edit OIDC Integration
            </Button>
          </div>
        </div>
      ) : (
        <CreateOIDCIntegrationForm
          organizationId={props.organizationId}
          close={props.close}
          key={props.organizationId}
        />
      )}
    </Modal>
  );
};

const CreateOIDCIntegrationForm = (props: { organizationId: string; close: () => void }): ReactElement => {
  const [mutation, mutate] = useMutation(CreateOIDCIntegrationModal_CreateOIDCIntegrationMutation);

  const formik = useFormik({
    initialValues: {
      domain: '',
      clientId: '',
      clientSecret: '',
    },
    onSubmit: async values => {
      const result = await mutate({
        input: {
          organizationId: props.organizationId,
          domain: values.domain,
          clientId: values.clientId,
          clientSecret: values.clientSecret,
        },
      });

      if (result.error) {
        // TODO handle unexpected error
        alert(result.error);
        return;
      }

      if (result.data?.createOIDCIntegration.ok) {
        props.close();
      }
    },
  });

  return (
    <form className="flex flex-col items-center gap-5" onSubmit={formik.handleSubmit}>
      <Heading>Create OpenID Connect Integration</Heading>
      <p>
        Connecting an OIDC provider to this organization allows users to automatically log in and be part of this
        organization.
      </p>
      <p>Use Okta, Auth0, Google Workspaces or any other OAuth2 Open ID Connect compatible provider.</p>
      <Input
        placeholder="Domain (Issuer)"
        id="domain"
        name="domain"
        prefix={<label className="text-sm font-semibold">Domain</label>}
        onChange={formik.handleChange}
        value={formik.values.domain}
        isInvalid={!!mutation.data?.createOIDCIntegration.error?.details.domain}
      />
      <div>{mutation.data?.createOIDCIntegration.error?.details.domain}</div>

      <Input
        placeholder="Client ID"
        id="clientId"
        name="clientId"
        prefix={<label className="text-sm font-semibold">Client ID</label>}
        onChange={formik.handleChange}
        value={formik.values.clientId}
        isInvalid={!!mutation.data?.createOIDCIntegration.error?.details.clientId}
      />
      <div>{mutation.data?.createOIDCIntegration.error?.details.clientId}</div>

      <Input
        placeholder="Client Secret"
        id="clientSecret"
        name="clientSecret"
        prefix={<label className="text-sm font-semibold">Client Secret</label>}
        onChange={formik.handleChange}
        value={formik.values.clientSecret}
        isInvalid={!!mutation.data?.createOIDCIntegration.error?.details.clientSecret}
      />
      <div>{mutation.data?.createOIDCIntegration.error?.details.clientSecret}</div>

      <div className="flex w-full gap-2">
        <Button type="button" size="large" block onClick={props.close}>
          Cancel
        </Button>
        <Button type="submit" size="large" block variant="primary" disabled={mutation.fetching}>
          Create OIDC Integration
        </Button>
      </div>
    </form>
  );
};

const UpdateOIDCIntegrationModal = (props: {
  isOpen: boolean;
  close: () => void;
  oidcIntegration: DocumentType<typeof UpdateOIDCIntegration_OIDCIntegrationFragment> | null;
  openCreateModalLink: string;
}): ReactElement => {
  return (
    <Modal open={props.isOpen} onOpenChange={props.close} className="w-[800px]">
      {props.oidcIntegration === null ? (
        <div className="flex flex-col items-center gap-5">
          <Heading>Update OpenID Connect Integration</Heading>
          <p>You are trying to update an OpenID Connect integration for an organization that has no integration.</p>
          <div className="flex w-full gap-2">
            <Button type="button" size="large" block onClick={props.close}>
              Close
            </Button>
            <Button type="submit" size="large" block variant="primary" href={props.openCreateModalLink}>
              Create OIDC Integration
            </Button>
          </div>
        </div>
      ) : (
        <UpdateOIDCIntegrationForm
          close={props.close}
          key={props.oidcIntegration.id}
          oidcIntegration={props.oidcIntegration}
        />
      )}
    </Modal>
  );
};

const UpdateOIDCIntegration_OIDCIntegrationFragment = gql(/* GraphQL */ `
  fragment UpdateOIDCIntegration_OIDCIntegrationFragment on OIDCIntegration {
    id
    domain
    clientId
    clientSecretPreview
  }
`);

const UpdateOIDCIntegrationForm_UpdateOIDCIntegrationMutation = gql(/* GraphQL */ `
  mutation UpdateOIDCIntegrationForm_UpdateOIDCIntegrationMutation($input: UpdateOIDCIntegrationInput!) {
    updateOIDCIntegration(input: $input) {
      ok {
        updatedOIDCIntegration {
          id
          domain
          clientId
          clientSecretPreview
        }
      }
      error {
        message
        details {
          clientId
          clientSecret
          domain
        }
      }
    }
  }
`);

const UpdateOIDCIntegrationForm = (props: {
  close: () => void;
  oidcIntegration: DocumentType<typeof UpdateOIDCIntegration_OIDCIntegrationFragment>;
}): ReactElement => {
  const [mutation, mutate] = useMutation(UpdateOIDCIntegrationForm_UpdateOIDCIntegrationMutation);

  const formik = useFormik({
    initialValues: {
      domain: props.oidcIntegration.domain,
      clientId: props.oidcIntegration.clientId,
      clientSecret: '',
    },
    onSubmit: async values => {
      const result = await mutate({
        input: {
          oidcIntegrationId: props.oidcIntegration.id,
          domain: values.domain,
          clientId: values.clientId,
          clientSecret: values.clientSecret === '' ? undefined : values.clientSecret,
        },
      });

      if (result.error) {
        // TODO handle unexpected error
        alert(result.error);
        return;
      }

      if (result.data?.updateOIDCIntegration.ok) {
        props.close();
      }
    },
  });

  return (
    <form className="flex flex-col items-stretch gap-5" onSubmit={formik.handleSubmit}>
      <Heading>Update OpenID Connect Integration</Heading>
      <Input
        placeholder="Domain (Issuer)"
        id="domain"
        name="domain"
        prefix={<label className="text-sm font-semibold">Domain</label>}
        onChange={formik.handleChange}
        value={formik.values.domain}
        isInvalid={!!mutation.data?.updateOIDCIntegration.error?.details.domain}
      />
      <div>{mutation.data?.updateOIDCIntegration.error?.details.domain}</div>

      <Input
        placeholder="Client ID"
        id="clientId"
        name="clientId"
        prefix={<label className="text-sm font-semibold">Client ID</label>}
        onChange={formik.handleChange}
        value={formik.values.clientId}
        isInvalid={!!mutation.data?.updateOIDCIntegration.error?.details.clientId}
      />
      <div>{mutation.data?.updateOIDCIntegration.error?.details.clientId}</div>

      <Input
        placeholder={
          'Keep old value. (Ending with ' +
          props.oidcIntegration.clientSecretPreview.substring(props.oidcIntegration.clientSecretPreview.length - 4) +
          ')'
        }
        id="clientSecret"
        name="clientSecret"
        prefix={<label className="text-sm font-semibold">Client Secret</label>}
        onChange={formik.handleChange}
        value={formik.values.clientSecret}
        isInvalid={!!mutation.data?.updateOIDCIntegration.error?.details.clientSecret}
      />
      <div>{mutation.data?.updateOIDCIntegration.error?.details.clientSecret}</div>

      <div className="flex w-full gap-2">
        <Button type="button" size="large" block onClick={props.close}>
          Cancel
        </Button>
        <Button type="submit" size="large" block variant="primary" disabled={mutation.fetching}>
          Update OIDC Integration
        </Button>
      </div>
    </form>
  );
};

const DeleteOIDCIntegrationForm_UpdateOIDCIntegrationMutation = gql(/* GraphQL */ `
  mutation DeleteOIDCIntegrationForm_UpdateOIDCIntegrationMutation($input: DeleteOIDCIntegrationInput!) {
    deleteOIDCIntegration(input: $input) {
      ok {
        organization {
          ...OIDCIntegrationSection_OrganizationFragment
        }
      }
      error {
        message
      }
    }
  }
`);

const DeleteOIDCIntegrationModal = (props: {
  isOpen: boolean;
  close: () => void;
  oidcIntegrationId: null | string;
}) => {
  const [mutation, mutate] = useMutation(DeleteOIDCIntegrationForm_UpdateOIDCIntegrationMutation);
  const { oidcIntegrationId } = props;

  return (
    <Modal open={props.isOpen} onOpenChange={props.close} className="w-[800px]">
      <div className="flex flex-col items-center gap-5">
        <Heading>Delete OpenID Connect Integration</Heading>
        {mutation.data?.deleteOIDCIntegration.ok ? (
          <>
            <p>The OIDC integration has been deleted successfully.</p>
            <div className="flex w-full gap-2">
              <Button type="button" size="large" block onClick={props.close}>
                Close
              </Button>
            </div>
          </>
        ) : oidcIntegrationId === null ? (
          <>
            <p>This organization does not have an OIDC integration.</p>
            <div className="flex w-full gap-2">
              <Button type="button" size="large" block onClick={props.close}>
                Close
              </Button>
            </div>
          </>
        ) : (
          <>
            <p>Do you really want to delete this OIDC integraton?</p>
            <div className="flex w-full gap-2">
              <Button type="button" size="large" block onClick={props.close}>
                Close
              </Button>
              <Button
                size="large"
                block
                danger
                disabled={mutation.fetching}
                onClick={() => {
                  mutate({
                    input: { oidcIntegrationId },
                  });
                }}
              >
                Delete
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
