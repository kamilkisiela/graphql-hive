import { ReactElement, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useFormik } from 'formik';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useClient, useMutation } from 'urql';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Heading, Input, Button as LegacyButton, Modal, Tag } from '@/components/v2';
import { AlertTriangleIcon, KeyIcon } from '@/components/v2/icon';
import { InlineCode } from '@/components/v2/inline-code';
import { env } from '@/env/frontend';
import { DocumentType, FragmentType, graphql, useFragment } from '@/gql';
import { useResetState } from '@/lib/hooks/use-reset-state';
import { cn } from '@/lib/utils';
import { Link, useRouter } from '@tanstack/react-router';

const classes = {
  container: cn('flex flex-col items-stretch gap-2'),
  modal: cn('w-[550px]'),
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

  const hash = router.latestLocation.hash;
  const isCreateOIDCIntegrationModalOpen = hash.endsWith('create-oidc-integration');
  const isUpdateOIDCIntegrationModalOpen = hash.endsWith('manage-oidc-integration');
  const isDeleteOIDCIntegrationModalOpen = hash.endsWith('remove-oidc-integration');
  const isDebugOIDCIntegrationModalOpen = hash.endsWith('debug-oidc-integration');
  const href = router.latestLocation.href;

  const closeModal = () => {
    void router.navigate({
      to: href,
    });
  };

  const openCreateModalLink = `${href}#create-oidc-integration`;
  const openEditModalLink = `${href}#manage-oidc-integration`;
  const openDeleteModalLink = `${href}#remove-oidc-integration`;
  const openDebugModalLink = `${href}#debug-oidc-integration`;

  return (
    <>
      <div className="flex items-center gap-x-2">
        {organization.oidcIntegration ? (
          <>
            <Link
              className={buttonVariants({ variant: 'default' })}
              href={openEditModalLink}
              onClick={ev => {
                ev.preventDefault();
                void router.navigate({
                  to: openEditModalLink,
                });
              }}
            >
              <KeyIcon className="mr-2 size-4" />
              Manage OIDC Provider (
              {extractDomain(organization.oidcIntegration.authorizationEndpoint)})
            </Link>
            <Link
              className={cn(buttonVariants({ variant: 'default' }), 'px-5')}
              href={openDebugModalLink}
              onClick={ev => {
                ev.preventDefault();
                void router.navigate({
                  to: openDebugModalLink,
                });
              }}
            >
              Show Debug Logs
            </Link>
            <Link
              className={cn(buttonVariants({ variant: 'destructive' }), 'px-5')}
              href={openDeleteModalLink}
              onClick={ev => {
                ev.preventDefault();
                void router.navigate({
                  to: openDeleteModalLink,
                });
              }}
            >
              Remove
            </Link>
          </>
        ) : (
          <LegacyButton
            size="large"
            as="a"
            href={openCreateModalLink}
            onClick={ev => {
              ev.preventDefault();
              void router.navigate({
                to: openCreateModalLink,
              });
            }}
          >
            <KeyIcon className="mr-2" />
            Connect Open ID Connect Provider
          </LegacyButton>
        )}
      </div>
      <CreateOIDCIntegrationModal
        isOpen={isCreateOIDCIntegrationModalOpen}
        close={closeModal}
        hasOIDCIntegration={!!organization.oidcIntegration}
        organizationId={organization.id}
        openEditModalLink={openEditModalLink}
        transitionToManageScreen={() => {
          // TODO(router)
          void router.navigate({
            hash: 'manage-oidc-integration',
          });
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
      {organization.oidcIntegration && (
        <DebugOIDCIntegrationModal
          isOpen={isDebugOIDCIntegrationModalOpen}
          close={closeModal}
          oidcIntegrationId={organization.oidcIntegration.id}
        />
      )}
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
            <LegacyButton type="button" size="large" block onClick={props.close}>
              Close
            </LegacyButton>
            <LegacyButton
              type="submit"
              size="large"
              block
              variant="primary"
              href={props.openEditModalLink}
            >
              Edit OIDC Integration
            </LegacyButton>
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
        <LegacyButton type="button" size="large" block onClick={props.close}>
          Cancel
        </LegacyButton>
        <LegacyButton
          type="submit"
          size="large"
          block
          variant="primary"
          disabled={mutation.fetching}
        >
          Connect OIDC Provider
        </LegacyButton>
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
          <LegacyButton type="button" size="large" block onClick={props.close}>
            Close
          </LegacyButton>
          <LegacyButton
            type="submit"
            size="large"
            block
            variant="primary"
            href={props.openCreateModalLink}
          >
            Connect OIDC Provider
          </LegacyButton>
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
      <form className={cn(classes.container, 'flex-1 gap-12')} onSubmit={formik.handleSubmit}>
        <Heading>Manage OpenID Connect Integration</Heading>
        <div className="flex">
          <div className={cn(classes.container, 'flex flex-1 flex-col pr-5')}>
            <Heading size="lg">OIDC Provider Instructions</Heading>
            <ul className="flex flex-col gap-5">
              <li>
                <div className="pb-1"> Set your OIDC Provider Sign-in redirect URI to </div>
                <InlineCode content={`${env.appBaseUrl}/auth/callback/oidc`} />
              </li>
              <li>
                <div className="pb-1"> Set your OIDC Provider Sign-out redirect URI to </div>
                <InlineCode content={`${env.appBaseUrl}/logout`} />
              </li>
              <li>
                <div className="pb-1">Your users can login to the organization via </div>
                <InlineCode
                  content={`${env.appBaseUrl}/auth/oidc?id=${props.oidcIntegration.id}`}
                />
              </li>
            </ul>
          </div>
          <div className={cn(classes.container, 'flex-1 pl-5')}>
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
        <div className="mt-4 flex w-full gap-2 self-end">
          <LegacyButton type="button" size="large" block onClick={props.close} tabIndex={0}>
            Close
          </LegacyButton>
          <LegacyButton
            type="submit"
            size="large"
            block
            variant="primary"
            disabled={mutation.fetching}
          >
            Save
          </LegacyButton>
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
              <LegacyButton type="button" size="large" block onClick={props.close}>
                Close
              </LegacyButton>
            </div>
          </>
        ) : oidcIntegrationId === null ? (
          <>
            <p>This organization does not have an OIDC integration.</p>
            <div className="flex w-full gap-2">
              <LegacyButton type="button" size="large" block onClick={props.close}>
                Close
              </LegacyButton>
            </div>
          </>
        ) : (
          <>
            <Tag color="yellow" className="px-4 py-2.5">
              <AlertTriangleIcon className="size-5" />
              <p className="ml-3">
                This action is not reversible and <b>deletes all users</b> that have signed in with
                this OIDC integration.
              </p>
            </Tag>
            <p>Do you really want to proceed?</p>

            <div className="flex w-full gap-2">
              <LegacyButton type="button" size="large" block onClick={props.close}>
                Close
              </LegacyButton>
              <LegacyButton
                size="large"
                block
                danger
                disabled={mutation.fetching}
                onClick={async () => {
                  await mutate({ input: { oidcIntegrationId } });
                }}
              >
                Delete
              </LegacyButton>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

const SubscribeToOIDCIntegrationLogSubscription = graphql(`
  subscription oidcProviderLog($oidcIntegrationId: ID!) {
    oidcIntegrationLog(input: { oidcIntegrationId: $oidcIntegrationId }) {
      timestamp
      message
    }
  }
`);

type OIDCLogEventType = DocumentType<
  typeof SubscribeToOIDCIntegrationLogSubscription
>['oidcIntegrationLog'];

function DebugOIDCIntegrationModal(props: {
  isOpen: boolean;
  close: () => void;
  oidcIntegrationId: string;
}) {
  const client = useClient();

  const [isSubscribing, setIsSubscribing] = useResetState(true, [props.isOpen]);

  const [logs, setLogs] = useResetState<Array<OIDCLogEventType>>([], [props.isOpen]);
  const ref = useRef<VirtuosoHandle>(null);
  useEffect(() => {
    ref.current?.scrollToIndex({
      index: logs.length - 1,
      behavior: 'smooth',
    });
  }, [logs]);

  useEffect(() => {
    if (isSubscribing && props.oidcIntegrationId && props.isOpen) {
      setLogs(logs => [
        ...logs,
        {
          __typename: 'OIDCIntegrationLogEvent',
          timestamp: new Date().toISOString(),
          message: 'Subscribing to logs...',
        },
      ]);
      const sub = client
        .subscription(SubscribeToOIDCIntegrationLogSubscription, {
          oidcIntegrationId: props.oidcIntegrationId,
        })
        .subscribe(next => {
          if (next.data?.oidcIntegrationLog) {
            const log = next.data.oidcIntegrationLog;
            setLogs(logs => [...logs, log]);
          }
        });

      return () => {
        setLogs(logs => [
          ...logs,
          {
            __typename: 'OIDCIntegrationLogEvent',
            timestamp: new Date().toISOString(),
            message: 'Stopped subscribing to logs...',
          },
        ]);

        sub.unsubscribe();
      };
    }
  }, [props.oidcIntegrationId, props.isOpen, isSubscribing]);

  return (
    <Dialog open={props.isOpen} onOpenChange={props.close}>
      <DialogContent className="min-w-[750px]">
        <DialogHeader>
          <DialogTitle>Debug OpenID Connect Integration</DialogTitle>
          <DialogDescription>
            Here you can listen to the live logs for debugging your OIDC integration.
          </DialogDescription>
        </DialogHeader>
        <Virtuoso
          ref={ref}
          className="h-[300px]"
          initialTopMostItemIndex={logs.length - 1}
          followOutput
          data={logs}
          itemContent={(_, logRow) => {
            return (
              <div className="flex px-2 pb-1 font-mono text-xs">
                <time dateTime={logRow.timestamp} className="pr-4">
                  {format(logRow.timestamp, 'HH:mm:ss')}
                </time>
                {logRow.message}
              </div>
            );
          }}
        />
        <DialogFooter>
          <Button type="button" onClick={props.close} tabIndex={0} variant="destructive">
            Close
          </Button>
          <Button
            type="submit"
            onClick={() => {
              setIsSubscribing(isSubscribed => !isSubscribed);
            }}
          >
            {isSubscribing ? 'Stop subscription' : 'Subscribe to logs'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
