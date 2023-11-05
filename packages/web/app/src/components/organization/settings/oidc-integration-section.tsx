import { ReactElement } from 'react';
import { useRouter } from 'next/router';
import { clsx } from 'clsx';
import { useFormik } from 'formik';
import { useMutation } from 'urql';
import { Button, Heading, Input, Modal, Tag } from '@/components/v2';
import { AlertTriangleIcon, KeyIcon } from '@/components/v2/icon';
import { InlineCode } from '@/components/v2/inline-code';
import { env } from '@/env/frontend';
import { DocumentType, FragmentType, graphql, useFragment } from '@/gql';

const classes = {
  container: clsx('flex flex-col items-stretch gap-5'),
  modal: clsx('w-[550px]'),
};

const OIDCIntegrationSection_OrganizationFragment = graphql(`
  fragment OIDCIntegrationSection_OrganizationFragment on Organization {
    id
    oidcIntegration {
      id
      ...UpdateOIDCIntegration_OIDCIntegrationFragment
      authorizationEndpoint
    }
  }
`);

function extractDomain(rawUrl: string) {
  const url = new URL(rawUrl);
  return url.host;
}

export function OIDCIntegrationSection(props: {
  organization: FragmentType<typeof OIDCIntegrationSection_OrganizationFragment>;
}): ReactElement {
  const router = useRouter();
  const organization = useFragment(OIDCIntegrationSection_OrganizationFragment, props.organization);

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
        {organization.oidcIntegration ? (
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
              {extractDomain(organization.oidcIntegration.authorizationEndpoint)})
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
        hasOIDCIntegration={!!organization.oidcIntegration}
        organizationId={organization.id}
        openEditModalLink={openEditModalLink}
        transitionToManageScreen={() => {
          void router.replace(openEditModalLink);
        }}
      />
      <ManageOIDCIntegrationModal
        key={organization.oidcIntegration?.id ?? 'noop'}
        oidcIntegration={organization.oidcIntegration ?? null}
        isOpen={isUpdateOIDCIntegrationModalOpen}
        close={closeModal}
        openCreateModalLink={openCreateModalLink}
      />
      <RemoveOIDCIntegrationModal
        isOpen={isDeleteOIDCIntegrationModalOpen}
        close={closeModal}
        oidcIntegrationId={organization.oidcIntegration?.id ?? null}
      />
    </>
  );
}

const CreateOIDCIntegrationModal_CreateOIDCIntegrationMutation = graphql(`
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

function CreateOIDCIntegrationModal(props: {
  isOpen: boolean;
  close: () => void;
  hasOIDCIntegration: boolean;
  organizationId: string;
  openEditModalLink: string;
  transitionToManageScreen: () => void;
}): ReactElement {
  return (
    <Modal open={props.isOpen} onOpenChange={props.close} className={classes.modal}>
      {props.hasOIDCIntegration ? (
        <div className={classes.container}>
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
}

function CreateOIDCIntegrationForm(props: {
  organizationId: string;
  close: () => void;
  transitionToManageScreen: () => void;
}): ReactElement {
  const [mutation, mutate] = useMutation(CreateOIDCIntegrationModal_CreateOIDCIntegrationMutation);

  const formik = useFormik({
    initialValues: {
      tokenEndpoint: '',
      userinfoEndpoint: '',
      authorizationEndpoint: '',
      clientId: '',
      clientSecret: '',
    },
    async onSubmit(values) {
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
    <form className={classes.container} onSubmit={formik.handleSubmit}>
      <Heading>Connect OpenID Connect Provider</Heading>
      <p>
        Connecting an OIDC provider to this organization allows users to automatically log in and be
        part of this organization.
      </p>
      <p>
        Use Okta, Auth0, Google Workspaces or any other OAuth2 Open ID Connect compatible provider.
      </p>

      <label className="text-sm font-semibold" htmlFor="tokenEndpoint">
        Token Endpoint
      </label>

      <Input
        placeholder="OAuth Token Endpoint API"
        id="tokenEndpoint"
        name="tokenEndpoint"
        onChange={formik.handleChange}
        value={formik.values.tokenEndpoint}
        isInvalid={!!mutation.data?.createOIDCIntegration.error?.details.tokenEndpoint}
      />
      <div>{mutation.data?.createOIDCIntegration.error?.details.tokenEndpoint}</div>

      <label className="text-sm font-semibold" htmlFor="userinfoEndpoint">
        User Info Endpoint
      </label>
      <Input
        placeholder="OAuth User Info Endpoint API"
        id="userinfoEndpoint"
        name="userinfoEndpoint"
        onChange={formik.handleChange}
        value={formik.values.userinfoEndpoint}
        isInvalid={!!mutation.data?.createOIDCIntegration.error?.details.userinfoEndpoint}
      />
      <div>{mutation.data?.createOIDCIntegration.error?.details.userinfoEndpoint}</div>

      <label className="text-sm font-semibold" htmlFor="authorizationEndpoint">
        Authorization Endpoint
      </label>
      <Input
        placeholder="OAuth Authorization Endpoint API"
        id="authorizationEndpoint"
        name="authorizationEndpoint"
        onChange={formik.handleChange}
        value={formik.values.authorizationEndpoint}
        isInvalid={!!mutation.data?.createOIDCIntegration.error?.details.authorizationEndpoint}
      />
      <div>{mutation.data?.createOIDCIntegration.error?.details.authorizationEndpoint}</div>

      <label className="text-sm font-semibold" htmlFor="clientId">
        Client ID
      </label>
      <Input
        placeholder="Client ID"
        id="clientId"
        name="clientId"
        onChange={formik.handleChange}
        value={formik.values.clientId}
        isInvalid={!!mutation.data?.createOIDCIntegration.error?.details.clientId}
      />
      <div>{mutation.data?.createOIDCIntegration.error?.details.clientId}</div>

      <label className="text-sm font-semibold" htmlFor="clientSecret">
        Client Secret
      </label>
      <Input
        placeholder="Client Secret"
        id="clientSecret"
        name="clientSecret"
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
}

function ManageOIDCIntegrationModal(props: {
  isOpen: boolean;
  close: () => void;
  oidcIntegration: FragmentType<typeof UpdateOIDCIntegration_OIDCIntegrationFragment> | null;
  openCreateModalLink: string;
}): ReactElement {
  const oidcIntegration = useFragment(
    UpdateOIDCIntegration_OIDCIntegrationFragment,
    props.oidcIntegration,
  );

  return oidcIntegration == null ? (
    <Modal open={props.isOpen} onOpenChange={props.close} className={classes.modal}>
      <div className={classes.container}>
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
      key={oidcIntegration.id}
      oidcIntegration={oidcIntegration}
    />
  );
}

const UpdateOIDCIntegration_OIDCIntegrationFragment = graphql(`
  fragment UpdateOIDCIntegration_OIDCIntegrationFragment on OIDCIntegration {
    id
    tokenEndpoint
    userinfoEndpoint
    authorizationEndpoint
    clientId
    clientSecretPreview
  }
`);

const UpdateOIDCIntegrationForm_UpdateOIDCIntegrationMutation = graphql(`
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

function UpdateOIDCIntegrationForm(props: {
  close: () => void;
  isOpen: boolean;
  oidcIntegration: DocumentType<typeof UpdateOIDCIntegration_OIDCIntegrationFragment>;
}): ReactElement {
  const [mutation, mutate] = useMutation(UpdateOIDCIntegrationForm_UpdateOIDCIntegrationMutation);

  const formik = useFormik({
    initialValues: {
      tokenEndpoint: props.oidcIntegration.tokenEndpoint,
      userinfoEndpoint: props.oidcIntegration.userinfoEndpoint,
      authorizationEndpoint: props.oidcIntegration.authorizationEndpoint,
      clientId: props.oidcIntegration.clientId,
      clientSecret: '',
    },
    async onSubmit(values) {
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
      <form className={clsx(classes.container, 'flex-1 gap-12')} onSubmit={formik.handleSubmit}>
        <Heading>Manage OpenID Connect Integration</Heading>
        <div className="flex">
          <div className={clsx(classes.container, 'flex flex-1 flex-col pr-5')}>
            <Heading size="lg">OIDC Provider Instructions</Heading>
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
          <div className={clsx(classes.container, 'flex-1 pl-5')}>
            <Heading size="lg">Properties</Heading>

            <label className="text-sm font-semibold" htmlFor="tokenEndpoint">
              Token Endpoint
            </label>
            <Input
              placeholder="OAuth Token Endpoint API"
              id="tokenEndpoint"
              name="tokenEndpoint"
              onChange={formik.handleChange}
              value={formik.values.tokenEndpoint}
              isInvalid={!!mutation.data?.updateOIDCIntegration.error?.details.tokenEndpoint}
            />
            <div>{mutation.data?.updateOIDCIntegration.error?.details.tokenEndpoint}</div>

            <label className="text-sm font-semibold" htmlFor="userinfoEndpoint">
              User Info Endpoint
            </label>
            <Input
              placeholder="OAuth User Info Endpoint API"
              id="userinfoEndpoint"
              name="userinfoEndpoint"
              onChange={formik.handleChange}
              value={formik.values.userinfoEndpoint}
              isInvalid={!!mutation.data?.updateOIDCIntegration.error?.details.userinfoEndpoint}
            />
            <div>{mutation.data?.updateOIDCIntegration.error?.details.userinfoEndpoint}</div>

            <label className="text-sm font-semibold" htmlFor="authorizationEndpoint">
              Authorization Endpoint
            </label>
            <Input
              placeholder="OAuth Authorization Endpoint API"
              id="authorizationEndpoint"
              name="authorizationEndpoint"
              onChange={formik.handleChange}
              value={formik.values.authorizationEndpoint}
              isInvalid={
                !!mutation.data?.updateOIDCIntegration.error?.details.authorizationEndpoint
              }
            />
            <div>{mutation.data?.updateOIDCIntegration.error?.details.authorizationEndpoint}</div>

            <label className="text-sm font-semibold" htmlFor="clientId">
              Client ID
            </label>
            <Input
              placeholder="Client ID"
              id="clientId"
              name="clientId"
              onChange={formik.handleChange}
              value={formik.values.clientId}
              isInvalid={!!mutation.data?.updateOIDCIntegration.error?.details.clientId}
            />
            <div>{mutation.data?.updateOIDCIntegration.error?.details.clientId}</div>

            <label className="text-sm font-semibold" htmlFor="clientSecret">
              Client Secret
            </label>
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
}

const RemoveOIDCIntegrationForm_DeleteOIDCIntegrationMutation = graphql(`
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

function RemoveOIDCIntegrationModal(props: {
  isOpen: boolean;
  close: () => void;
  oidcIntegrationId: null | string;
}): ReactElement {
  const [mutation, mutate] = useMutation(RemoveOIDCIntegrationForm_DeleteOIDCIntegrationMutation);
  const { oidcIntegrationId } = props;

  return (
    <Modal open={props.isOpen} onOpenChange={props.close} className={classes.modal}>
      <div className={classes.container}>
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
            <Tag color="yellow" className="px-4 py-2.5">
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
                  await mutate({ input: { oidcIntegrationId } });
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
}
