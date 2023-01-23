import { ReactElement } from 'react';
import { useRouter } from 'next/router';
import { useFormik } from 'formik';
import { DocumentType, gql, useMutation } from 'urql';
import { Button, Input, Modal, Tag } from '@/components/v2';
import { AlertTriangleIcon, KeyIcon } from '@/components/v2/icon';
import { InlineCode } from '@/components/v2/inline-code';
import { env } from '@/env/frontend';
import { Heading } from '@chakra-ui/react';

const containerClassName = 'flex flex-col items-stretch gap-5';
const modalWidthClassName = 'w-[550px]';

const OIDCIntegrationSection_OrganizationFragment = gql(/* GraphQL */ `
  fragment OIDCIntegrationSection_OrganizationFragment on Organization {
    id
    oidcIntegration {
      id
      ...UpdateOIDCIntegration_OIDCIntegrationFragment
    }
  }
`);

const extractDomain = (rawUrl: string) => {
  const url = new URL(rawUrl);
  return url.host;
};

export const OIDCIntegrationSection = (props: {
  organization: DocumentType<typeof OIDCIntegrationSection_OrganizationFragment>;
}): ReactElement => {
  const router = useRouter();

  const isCreateOIDCIntegrationModalOpen = router.asPath.endsWith('#create-oidc-integration');
  const isUpdateOIDCIntegrationModalOpen = router.asPath.endsWith('#manage-oidc-integration');
  const isDeleteOIDCIntegrationModalOpen = router.asPath.endsWith('#remove-oidc-integration');

  const closeModal = () => {
    void router.push(router.asPath.split('#')[0]);
  };

  const openCreateModalLink = `${router.asPath}#create-oidc-integration`;
  const openEditModalLink = `${router.asPath}#manage-oidc-integration`;
  const openDeleteModalLink = `${router.asPath}#remove-oidc-integration`;

  return (
    <>
      <div className="flex items-center gap-x-2">
        {props.organization.oidcIntegration ? (
          <>
            <Button
              as="a"
              variant="secondary"
              size="large"
              href={openEditModalLink}
              onClick={ev => {
                ev.preventDefault();
                void router.push(openEditModalLink);
              }}
            >
              <KeyIcon className="mr-2" />
              Manage OIDC Provider (
              {extractDomain(props.organization.oidcIntegration.authorizationEndpoint)})
            </Button>
            <Button
              variant="primary"
              danger
              size="large"
              className="px-5"
              as="a"
              href={openDeleteModalLink}
              onClick={ev => {
                ev.preventDefault();
                void router.push(openDeleteModalLink);
              }}
            >
              Remove
            </Button>
          </>
        ) : (
          <Button
            size="large"
            as="a"
            href={openCreateModalLink}
            onClick={ev => {
              ev.preventDefault();
              void router.push(openCreateModalLink);
            }}
          >
            <KeyIcon className="mr-2" />
            Connect Open ID Connect Provider
          </Button>
        )}
      </div>
      <CreateOIDCIntegrationModal
        isOpen={isCreateOIDCIntegrationModalOpen}
        close={closeModal}
        hasOIDCIntegration={!!props.organization.oidcIntegration}
        organizationId={props.organization.id}
        openEditModalLink={openEditModalLink}
        transitionToManageScreen={() => {
          void router.replace(openEditModalLink);
        }}
      />
      <ManageOIDCIntegrationModal
        key={props.organization.oidcIntegration?.id ?? 'noop'}
        oidcIntegration={props.organization.oidcIntegration ?? null}
        isOpen={isUpdateOIDCIntegrationModalOpen}
        close={closeModal}
        openCreateModalLink={openCreateModalLink}
      />
      <RemoveOIDCIntegrationModal
        isOpen={isDeleteOIDCIntegrationModalOpen}
        close={closeModal}
        oidcIntegrationId={props.organization.oidcIntegration?.id ?? null}
      />
    </>
  );
};

const CreateOIDCIntegrationModal_CreateOIDCIntegrationMutation = gql(/* GraphQL */ `
  mutation CreateOIDCIntegrationModal_CreateOIDCIntegrationMutation(
    $input: CreateOIDCIntegrationInput!
  ) {
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
          tokenEndpoint
          userinfoEndpoint
          authorizationEndpoint
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
  transitionToManageScreen: () => void;
}): ReactElement => {
  return (
    <Modal open={props.isOpen} onOpenChange={props.close} className={modalWidthClassName}>
      {props.hasOIDCIntegration === true ? (
        <div className={containerClassName}>
          <Heading>Connect OpenID Connect Provider</Heading>
          <p>
            You are trying to create an OpenID Connect integration for an organization that already
            has a provider attached. Please instead configure the existing provider.
          </p>
          <div className="flex w-full gap-2">
            <Button type="button" size="large" block onClick={props.close}>
              Close
            </Button>
            <Button
              type="submit"
              size="large"
              block
              variant="primary"
              href={props.openEditModalLink}
            >
              Edit OIDC Integration
            </Button>
          </div>
        </div>
      ) : (
        <CreateOIDCIntegrationForm
          organizationId={props.organizationId}
          close={props.close}
          key={props.organizationId}
          transitionToManageScreen={props.transitionToManageScreen}
        />
      )}
    </Modal>
  );
};

const CreateOIDCIntegrationForm = (props: {
  organizationId: string;
  close: () => void;
  transitionToManageScreen: () => void;
}): ReactElement => {
  const [mutation, mutate] = useMutation(CreateOIDCIntegrationModal_CreateOIDCIntegrationMutation);

  const formik = useFormik({
    initialValues: {
      tokenEndpoint: '',
      userinfoEndpoint: '',
      authorizationEndpoint: '',
      clientId: '',
      clientSecret: '',
    },
    onSubmit: async values => {
      const result = await mutate({
        input: {
          organizationId: props.organizationId,
          tokenEndpoint: values.tokenEndpoint,
          userinfoEndpoint: values.userinfoEndpoint,
          authorizationEndpoint: values.authorizationEndpoint,
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
        props.transitionToManageScreen();
      }
    },
  });

  return (
    <form className={containerClassName} onSubmit={formik.handleSubmit}>
      <Heading>Connect OpenID Connect Provider</Heading>
      <p>
        Connecting an OIDC provider to this organization allows users to automatically log in and be
        part of this organization.
      </p>
      <p>
        Use Okta, Auth0, Google Workspaces or any other OAuth2 Open ID Connect compatible provider.
      </p>

      <Input
        placeholder="OAuth Token Endpoint API"
        id="tokenEndpoint"
        name="tokenEndpoint"
        prefix={<label className="text-sm font-semibold">Token Endpoint</label>}
        onChange={formik.handleChange}
        value={formik.values.tokenEndpoint}
        isInvalid={!!mutation.data?.createOIDCIntegration.error?.details.tokenEndpoint}
      />
      <div>{mutation.data?.createOIDCIntegration.error?.details.tokenEndpoint}</div>

      <Input
        placeholder="OAuth User Info Endpoint API"
        id="userinfoEndpoint"
        name="userinfoEndpoint"
        prefix={<label className="text-sm font-semibold">User Info Endpoint</label>}
        onChange={formik.handleChange}
        value={formik.values.userinfoEndpoint}
        isInvalid={!!mutation.data?.createOIDCIntegration.error?.details.userinfoEndpoint}
      />
      <div>{mutation.data?.createOIDCIntegration.error?.details.userinfoEndpoint}</div>

      <Input
        placeholder="OAuth Authorization Endpoint API"
        id="authorizationEndpoint"
        name="authorizationEndpoint"
        prefix={<label className="text-sm font-semibold">Authorization Endpoint</label>}
        onChange={formik.handleChange}
        value={formik.values.authorizationEndpoint}
        isInvalid={!!mutation.data?.createOIDCIntegration.error?.details.authorizationEndpoint}
      />
      <div>{mutation.data?.createOIDCIntegration.error?.details.authorizationEndpoint}</div>

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
          Connect OIDC Provider
        </Button>
      </div>
    </form>
  );
};

const ManageOIDCIntegrationModal = (props: {
  isOpen: boolean;
  close: () => void;
  oidcIntegration: DocumentType<typeof UpdateOIDCIntegration_OIDCIntegrationFragment> | null;
  openCreateModalLink: string;
}): ReactElement => {
  return props.oidcIntegration === null ? (
    <Modal open={props.isOpen} onOpenChange={props.close} className={modalWidthClassName}>
      <div className={containerClassName}>
        <Heading>Manage OpenID Connect Integration</Heading>
        <p>
          You are trying to update an OpenID Connect integration for an organization that has no
          integration.
        </p>
        <div className="flex w-full gap-2">
          <Button type="button" size="large" block onClick={props.close}>
            Close
          </Button>
          <Button
            type="submit"
            size="large"
            block
            variant="primary"
            href={props.openCreateModalLink}
          >
            Connect OIDC Provider
          </Button>
        </div>
      </div>
    </Modal>
  ) : (
    <UpdateOIDCIntegrationForm
      close={props.close}
      isOpen={props.isOpen}
      key={props.oidcIntegration.id}
      oidcIntegration={props.oidcIntegration}
    />
  );
};

const UpdateOIDCIntegration_OIDCIntegrationFragment = gql(/* GraphQL */ `
  fragment UpdateOIDCIntegration_OIDCIntegrationFragment on OIDCIntegration {
    id
    tokenEndpoint
    userinfoEndpoint
    authorizationEndpoint
    clientId
    clientSecretPreview
  }
`);

const UpdateOIDCIntegrationForm_UpdateOIDCIntegrationMutation = gql(/* GraphQL */ `
  mutation UpdateOIDCIntegrationForm_UpdateOIDCIntegrationMutation(
    $input: UpdateOIDCIntegrationInput!
  ) {
    updateOIDCIntegration(input: $input) {
      ok {
        updatedOIDCIntegration {
          id
          tokenEndpoint
          userinfoEndpoint
          authorizationEndpoint
          clientId
          clientSecretPreview
        }
      }
      error {
        message
        details {
          clientId
          clientSecret
          tokenEndpoint
          userinfoEndpoint
          authorizationEndpoint
        }
      }
    }
  }
`);

const UpdateOIDCIntegrationForm = (props: {
  close: () => void;
  isOpen: boolean;
  oidcIntegration: DocumentType<typeof UpdateOIDCIntegration_OIDCIntegrationFragment>;
}): ReactElement => {
  const [mutation, mutate] = useMutation(UpdateOIDCIntegrationForm_UpdateOIDCIntegrationMutation);

  const formik = useFormik({
    initialValues: {
      tokenEndpoint: props.oidcIntegration.tokenEndpoint,
      userinfoEndpoint: props.oidcIntegration.userinfoEndpoint,
      authorizationEndpoint: props.oidcIntegration.authorizationEndpoint,
      clientId: props.oidcIntegration.clientId,
      clientSecret: '',
    },
    onSubmit: async values => {
      const result = await mutate({
        input: {
          oidcIntegrationId: props.oidcIntegration.id,
          tokenEndpoint: values.tokenEndpoint,
          userinfoEndpoint: values.userinfoEndpoint,
          authorizationEndpoint: values.authorizationEndpoint,
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
    <Modal open={props.isOpen} onOpenChange={props.close} className="flex min-h-[600px] w-[960px]">
      <form className={`${containerClassName} flex-1 gap-12`} onSubmit={formik.handleSubmit}>
        <Heading>Manage OpenID Connect Integration</Heading>
        <div className="flex">
          <div className={`${containerClassName} flex flex-1 flex-col pr-5`}>
            <Heading size="sm">OIDC Provider Instructions</Heading>
            <ul className="flex flex-col gap-5">
              <li>
                Set your OIDC Provider Sign-in redirect URI to{' '}
                <InlineCode content={`${env.appBaseUrl}/auth/callback/oidc`} />
              </li>
              <li>
                Set your OIDC Provider Sign-out redirect URI to{' '}
                <InlineCode content={`${env.appBaseUrl}/logout`} />
              </li>
              <li>
                Your users can login to the organization via{' '}
                <InlineCode
                  content={`${env.appBaseUrl}/auth/oidc?id=${props.oidcIntegration.id}`}
                />
              </li>
            </ul>
          </div>
          <div className={`${containerClassName} flex-1 pl-5`}>
            <Heading size="sm">Properties</Heading>

            <Input
              placeholder="OAuth Token Endpoint API"
              id="tokenEndpoint"
              name="tokenEndpoint"
              prefix={<label className="text-sm font-semibold">Token Endpoint</label>}
              onChange={formik.handleChange}
              value={formik.values.tokenEndpoint}
              isInvalid={!!mutation.data?.updateOIDCIntegration.error?.details.tokenEndpoint}
            />
            <div>{mutation.data?.updateOIDCIntegration.error?.details.tokenEndpoint}</div>

            <Input
              placeholder="OAuth User Info Endpoint API"
              id="userinfoEndpoint"
              name="userinfoEndpoint"
              prefix={<label className="text-sm font-semibold">User Info Endpoint</label>}
              onChange={formik.handleChange}
              value={formik.values.userinfoEndpoint}
              isInvalid={!!mutation.data?.updateOIDCIntegration.error?.details.userinfoEndpoint}
            />
            <div>{mutation.data?.updateOIDCIntegration.error?.details.userinfoEndpoint}</div>

            <Input
              placeholder="OAuth Authorization Endpoint API"
              id="authorizationEndpoint"
              name="authorizationEndpoint"
              prefix={<label className="text-sm font-semibold">Authorization Endpoint</label>}
              onChange={formik.handleChange}
              value={formik.values.authorizationEndpoint}
              isInvalid={
                !!mutation.data?.updateOIDCIntegration.error?.details.authorizationEndpoint
              }
            />
            <div>{mutation.data?.updateOIDCIntegration.error?.details.authorizationEndpoint}</div>

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
                props.oidcIntegration.clientSecretPreview.substring(
                  props.oidcIntegration.clientSecretPreview.length - 4,
                ) +
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
          </div>
        </div>
        <div className="mt-auto flex w-full gap-2 self-end">
          <Button type="button" size="large" block onClick={props.close} tabIndex={0}>
            Close
          </Button>
          <Button type="submit" size="large" block variant="primary" disabled={mutation.fetching}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
};

const RemoveOIDCIntegrationForm_DeleteOIDCIntegrationMutation = gql(/* GraphQL */ `
  mutation RemoveOIDCIntegrationForm_DeleteOIDCIntegrationMutation(
    $input: DeleteOIDCIntegrationInput!
  ) {
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

const RemoveOIDCIntegrationModal = (props: {
  isOpen: boolean;
  close: () => void;
  oidcIntegrationId: null | string;
}) => {
  const [mutation, mutate] = useMutation(RemoveOIDCIntegrationForm_DeleteOIDCIntegrationMutation);
  const { oidcIntegrationId } = props;

  return (
    <Modal open={props.isOpen} onOpenChange={props.close} className={modalWidthClassName}>
      <div className={containerClassName}>
        <Heading>Remove OpenID Connect Integration</Heading>
        {mutation.data?.deleteOIDCIntegration.ok ? (
          <>
            <p>The OIDC integration has been removed successfully.</p>
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
            <Tag color="yellow" className="py-2.5 px-4">
              <AlertTriangleIcon className="h-5 w-5" />
              <p className="ml-3">
                This action is not reversible and <b>deletes all users</b> that have signed in with
                this OIDC integration.
              </p>
            </Tag>
            <p>Do you really want to proceed?</p>

            <div className="flex w-full gap-2">
              <Button type="button" size="large" block onClick={props.close}>
                Close
              </Button>
              <Button
                size="large"
                block
                danger
                disabled={mutation.fetching}
                onClick={async () => {
                  await mutate({
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
