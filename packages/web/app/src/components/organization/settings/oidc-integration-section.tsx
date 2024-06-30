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
import { Tag } from '@/components/ui/tag';
import { Input } from '@/components/v2';
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
  const openCreateModalHash = 'create-oidc-integration';
  const openEditModalHash = 'manage-oidc-integration';
  const openDeleteModalHash = 'remove-oidc-integration';
  const openDebugModalHash = 'debug-oidc-integration';
  const isCreateOIDCIntegrationModalOpen = hash.endsWith(openCreateModalHash);
  const isUpdateOIDCIntegrationModalOpen = hash.endsWith(openEditModalHash);
  const isDeleteOIDCIntegrationModalOpen = hash.endsWith(openDeleteModalHash);
  const isDebugOIDCIntegrationModalOpen = hash.endsWith(openDebugModalHash);

  const closeModal = () => {
    void router.navigate({
      hash: undefined,
    });
  };

  return (
    <>
      <div className="flex items-center gap-x-2">
        {organization.oidcIntegration ? (
          <>
            <Link className={buttonVariants({ variant: 'default' })} hash={openEditModalHash}>
              <KeyIcon className="mr-2 size-4" />
              Manage OIDC Provider (
              {extractDomain(organization.oidcIntegration.authorizationEndpoint)})
            </Link>
            <Link
              className={cn(buttonVariants({ variant: 'default' }), 'px-5')}
              hash={openDebugModalHash}
            >
              Show Debug Logs
            </Link>
            <Link
              className={cn(buttonVariants({ variant: 'destructive' }), 'px-5')}
              hash={openDeleteModalHash}
            >
              Remove
            </Link>
          </>
        ) : (
          <Button asChild>
            <Link hash={openCreateModalHash}>
              <KeyIcon className="mr-2" />
              Connect Open ID Connect Provider
            </Link>
          </Button>
        )}
      </div>
      <CreateOIDCIntegrationModal
        isOpen={isCreateOIDCIntegrationModalOpen}
        close={closeModal}
        hasOIDCIntegration={!!organization.oidcIntegration}
        organizationId={organization.id}
        openEditModalHash={openEditModalHash}
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
        openCreateModalHash={openCreateModalHash}
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
  openEditModalHash: string;
  transitionToManageScreen: () => void;
}): ReactElement {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.close}>
      <DialogContent className={classes.modal}>
        {props.hasOIDCIntegration ? (
          <>
            <DialogHeader>
              <DialogTitle>Connect OpenID Connect Provider</DialogTitle>
              <DialogDescription>
                You are trying to create an OpenID Connect integration for an organization that
                already has a provider attached. Please configure the existing provider instead.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="space-x-2 text-right">
              <Button variant="outline" onClick={props.close}>
                Close
              </Button>
              <Button asChild>
                <Link hash={props.openEditModalHash}>Edit OIDC Integration</Link>
              </Button>
            </DialogFooter>
          </>
        ) : (
          <CreateOIDCIntegrationForm
            organizationId={props.organizationId}
            close={props.close}
            key={props.organizationId}
            transitionToManageScreen={props.transitionToManageScreen}
          />
        )}
      </DialogContent>
    </Dialog>
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
      <DialogHeader>
        <DialogTitle>Connect OpenID Connect Provider</DialogTitle>
        <DialogDescription>
          Connecting an OIDC provider to this organization allows users to automatically log in and
          be part of this organization.
        </DialogDescription>
        <DialogDescription>
          Use Okta, Auth0, Google Workspaces or any other OAuth2 Open ID Connect compatible
          provider.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2 pt-4">
        <div>
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
        </div>

        <div>
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
        </div>

        <div>
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
        </div>

        <div>
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
        </div>

        <div>
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
        </div>

        <div className="flex w-full justify-end gap-x-2">
          <Button variant="outline" disabled={mutation.fetching} onClick={props.close}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.fetching}>
            Connect OIDC Provider
          </Button>
        </div>
      </div>
    </form>
  );
}

function ManageOIDCIntegrationModal(props: {
  isOpen: boolean;
  close: () => void;
  oidcIntegration: FragmentType<typeof UpdateOIDCIntegration_OIDCIntegrationFragment> | null;
  openCreateModalHash: string;
}): ReactElement {
  const oidcIntegration = useFragment(
    UpdateOIDCIntegration_OIDCIntegrationFragment,
    props.oidcIntegration,
  );

  return oidcIntegration == null ? (
    <Dialog open={props.isOpen} onOpenChange={props.close}>
      <DialogContent className={classes.modal}>
        <DialogHeader>
          <DialogTitle>Manage OpenID Connect Integration</DialogTitle>
          <DialogDescription>
            You are trying to update an OpenID Connect integration for an organization that has no
            integration.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="space-x-2 text-right">
          <Button variant="outline" onClick={props.close}>
            Close
          </Button>
          <Button asChild>
            <Link hash={props.openCreateModalHash}>Connect OIDC Provider</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <Dialog open={props.isOpen} onOpenChange={props.close}>
      <DialogContent className="flex min-h-[600px] w-[960px] max-w-none">
        <form className={cn(classes.container, 'flex-1 gap-12')} onSubmit={formik.handleSubmit}>
          <DialogHeader>
            <DialogTitle>Manage OpenID Connect Integration</DialogTitle>
          </DialogHeader>

          <div className="flex">
            <div className={cn(classes.container, 'flex flex-1 flex-col pr-5')}>
              <DialogTitle>OIDC Provider Instructions</DialogTitle>
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
              <DialogTitle>Properties</DialogTitle>

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
          <DialogFooter className="space-x-2 text-right">
            <Button variant="outline" onClick={props.close} tabIndex={0}>
              Close
            </Button>
            <Button type="submit" disabled={mutation.fetching}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
    <Dialog open={props.isOpen} onOpenChange={props.close}>
      <DialogContent className={classes.modal}>
        <DialogHeader>
          <DialogTitle>Remove OpenID Connect Integration</DialogTitle>
        </DialogHeader>
        {mutation.data?.deleteOIDCIntegration.ok ? (
          <>
            <p>The OIDC integration has been removed successfully.</p>
            <div className="text-right">
              <Button onClick={props.close}>Close</Button>
            </div>
          </>
        ) : oidcIntegrationId === null ? (
          <>
            <p>This organization does not have an OIDC integration.</p>
            <div className="text-right">
              <Button onClick={props.close}>Close</Button>
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

            <div className="space-x-2 text-right">
              <Button variant="outline" onClick={props.close}>
                Close
              </Button>
              <Button
                variant="destructive"
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
      </DialogContent>
    </Dialog>
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
