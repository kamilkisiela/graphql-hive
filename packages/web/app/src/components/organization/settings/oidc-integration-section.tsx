import { ReactElement, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useClient, useMutation } from 'urql';
import { z } from 'zod';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { AlertTriangleIcon, KeyIcon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Tag } from '@/components/v2';
import { env } from '@/env/frontend';
import { DocumentType, FragmentType, graphql, useFragment } from '@/gql';
import { useClipboard } from '@/lib/hooks';
import { useResetState } from '@/lib/hooks/use-reset-state';
import { cn } from '@/lib/utils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation as useRQMutation } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';

function CopyInput(props: { value: string; id?: string }) {
  const copy = useClipboard();

  return (
    <div className="flex space-x-2">
      <Input id={props.id} value={props.value} readOnly />
      <Button
        variant="secondary"
        className="shrink-0"
        onClick={ev => {
          ev.preventDefault();
          void copy(props.value);
        }}
      >
        Copy
      </Button>
    </div>
  );
}

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
      {props.hasOIDCIntegration ? (
        <>
          <DialogContent className="container w-4/5 max-w-[600px] md:w-3/5">
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
          </DialogContent>
        </>
      ) : (
        <CreateOIDCIntegrationForm
          organizationId={props.organizationId}
          close={props.close}
          key={props.organizationId}
          transitionToManageScreen={props.transitionToManageScreen}
        />
      )}
    </Dialog>
  );
}

const OIDCMetadataSchema = z.object({
  token_endpoint: z
    .string({
      required_error: 'Token endpoint not found',
    })
    .url('Token endpoint must be a valid URL'),
  userinfo_endpoint: z
    .string({
      required_error: 'Userinfo endpoint not found',
    })
    .url('Userinfo endpoint must be a valid URL'),
  authorization_endpoint: z
    .string({
      required_error: 'Authorization endpoint not found',
    })
    .url('Authorization endpoint must be a valid URL'),
});

async function fetchOIDCMetadata(url: string) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    return {
      ok: false,
      error: {
        message: 'Failed to fetch metadata',
        details: {
          url,
          status: res.status,
          statusText: res.statusText,
          body: await res.text(),
        },
      },
    } as const;
  }

  return {
    ok: true,
    metadata: await res.json(),
  } as const;
}

const OIDCMetadataFormSchema = z.object({
  url: z.string().url('Must be a valid URL'),
});

type OIDCMetadataFormValues = z.infer<typeof OIDCMetadataFormSchema>;

function OIDCMetadataFetcher(props: {
  onEndpointChange(endpoints: { token: string; userinfo: string; authorization: string }): void;
}) {
  const { toast } = useToast();

  const fetchMetadata = useRQMutation({
    mutationFn: fetchOIDCMetadata,
    onSuccess(data) {
      if (!data.ok) {
        toast({
          title: data.error.message,
          description: (
            <div>
              <p>Status: {data.error.details.status}</p>
              <p>Response: {data.error.details.body ?? data.error.details.statusText}</p>
            </div>
          ),
          variant: 'destructive',
        });
        return;
      }

      const metadataResult = OIDCMetadataSchema.safeParse(data.metadata);
      if (!metadataResult.success) {
        toast({
          title: 'Failed to parse OIDC metadata',
          description: (
            <>
              {[
                metadataResult.error.formErrors.fieldErrors.authorization_endpoint?.[0],
                metadataResult.error.formErrors.fieldErrors.token_endpoint?.[0],
                metadataResult.error.formErrors.fieldErrors.userinfo_endpoint?.[0],
              ]
                .filter(Boolean)
                .map(msg => (
                  <p>{msg}</p>
                ))}
            </>
          ),
          variant: 'destructive',
        });
        return;
      }

      props.onEndpointChange({
        token: metadataResult.data.token_endpoint,
        userinfo: metadataResult.data.userinfo_endpoint,
        authorization: metadataResult.data.authorization_endpoint,
      });
    },
    onError(error) {
      console.error(error);
      toast({
        title: 'Failed to fetch OIDC metadata',
        description: 'Provide the endpoints manually or try again later',
        variant: 'destructive',
      });
    },
  });

  function onSubmit(data: OIDCMetadataFormValues) {
    fetchMetadata.mutate(data.url);
  }

  const form = useForm<OIDCMetadataFormValues>({
    resolver: zodResolver(OIDCMetadataFormSchema),
    defaultValues: {
      url: '',
    },
    mode: 'onSubmit',
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => {
            return (
              <FormItem>
                <div className="flex flex-row justify-center gap-x-4">
                  <FormControl>
                    <Input
                      disabled={fetchMetadata.isPending}
                      placeholder="https://my.okta.com/.well-known/openid-configuration"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <Button type="submit" className="w-48" disabled={fetchMetadata.isPending}>
                    {fetchMetadata.isPending ? 'Fetching...' : 'Fetch endpoints'}
                  </Button>
                </div>
                <FormDescription>
                  Provide the OIDC metadata URL to automatically fill in the fields below.
                </FormDescription>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      </form>
    </Form>
  );
}

const createOIDCIntegrationFormFormSchema = z.object({
  tokenEndpoint: z
    .string()
    .url('Must be a valid URL')
    .min(2, { message: 'Token endpoint is required' })
    .max(100, { message: 'Token endpoint is too long' }),
  userinfoEndpoint: z
    .string()
    .url('Must be a valid URL')
    .min(2, { message: 'Userinfo endpoint is required' })
    .max(100, { message: 'Userinfo endpoint is too long' }),
  authorizationEndpoint: z
    .string()
    .url('Must be a valid URL')
    .min(2, { message: 'Authorization endpoint is required' })
    .max(100, { message: 'Authorization endpoint is too long' }),
  clientId: z
    .string()
    .min(2, { message: 'Client ID is required' })
    .max(100, { message: 'Client ID is too long' }),
  clientSecret: z
    .string()
    .min(3, { message: 'Client Secret is too short' })
    .max(100, { message: 'Client Secret is too long' }),
});

type CreateOIDCIntegrationFormValues = z.infer<typeof createOIDCIntegrationFormFormSchema>;

function CreateOIDCIntegrationForm(props: {
  organizationId: string;
  close: () => void;
  transitionToManageScreen: () => void;
}): ReactElement {
  const [mutation, mutate] = useMutation(CreateOIDCIntegrationModal_CreateOIDCIntegrationMutation);
  const { toast } = useToast();

  const form = useForm<CreateOIDCIntegrationFormValues>({
    resolver: zodResolver(createOIDCIntegrationFormFormSchema),
    defaultValues: {
      tokenEndpoint: '',
      userinfoEndpoint: '',
      authorizationEndpoint: '',
      clientId: '',
      clientSecret: '',
    },
    mode: 'all',
  });

  async function onSubmit(data: CreateOIDCIntegrationFormValues) {
    const result = await mutate({
      input: {
        organizationId: props.organizationId,
        tokenEndpoint: data.tokenEndpoint,
        userinfoEndpoint: data.userinfoEndpoint,
        authorizationEndpoint: data.authorizationEndpoint,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
      },
    });

    if (result.error) {
      toast({
        title: 'Failed to create OIDC integration',
        description: result.error.message,
        variant: 'destructive',
      });
    }
    if (result.data?.createOIDCIntegration.ok) {
      props.close();
      props.transitionToManageScreen();
      form.reset();
      toast({
        title: 'OIDC integration created successfully',
        description: 'You can now manage the integration',
        variant: 'default',
      });
    }
  }

  return (
    <DialogContent className="container w-4/5 max-w-[850px] md:w-3/5">
      <DialogHeader>
        <DialogTitle>Connect OpenID Connect Provider</DialogTitle>
        <div className="space-y-2">
          <div className="bg-muted border-border rounded-md border p-3">
            <OIDCMetadataFetcher
              onEndpointChange={endpoints => {
                void form.setValue('tokenEndpoint', endpoints.token);
                void form.setValue('userinfoEndpoint', endpoints.userinfo);
                void form.setValue('authorizationEndpoint', endpoints.authorization);
                void form.clearErrors('tokenEndpoint');
                void form.clearErrors('userinfoEndpoint');
                void form.clearErrors('authorizationEndpoint');
              }}
            />
          </div>
        </div>
      </DialogHeader>
      <div className="flex flex-row gap-4">
        <div className="w-1/3">
          <DialogDescription className="font-semibold text-white">More info</DialogDescription>
          <DialogDescription>
            Connecting an OIDC provider to this organization allows users to automatically log in
            and be part of this organization.
          </DialogDescription>
          <br />
          <DialogDescription>
            Use Okta, Auth0, Google Workspaces or any other OAuth2 Open ID Connect compatible
            provider.
          </DialogDescription>
        </div>

        <Separator orientation="vertical" />

        <div className="w-2/3">
          <Form {...form}>
            <form className="space-y-2" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="tokenEndpoint"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Token Endpoint</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          placeholder="OAuth Token Endpoint API"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="userinfoEndpoint"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>User Info Endpoint</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          placeholder="OAuth User Info Endpoint API"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="authorizationEndpoint"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Authorization Endpoint</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="off"
                          placeholder="OAuth Authorization Endpoint API"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Client ID</FormLabel>
                      <FormControl>
                        <Input autoComplete="off" placeholder="Client ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <FormField
                control={form.control}
                name="clientSecret"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Client Secret</FormLabel>
                      <FormControl>
                        <Input autoComplete="off" placeholder="Client Secret" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  disabled={mutation.fetching}
                  onClick={en => {
                    en.preventDefault();
                    props.close();
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.fetching || !form.formState.isValid}>
                  Connect OIDC Provider
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </div>
    </DialogContent>
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
          <Button
            variant="outline"
            onClick={ev => {
              ev.preventDefault();
              props.close();
            }}
          >
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
    oidcUserAccessOnly
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

const UpdateOIDCIntegrationForm_UpdateOIDCRestrictionsMutation = graphql(`
  mutation UpdateOIDCIntegrationForm_UpdateOIDCRestrictionsMutation(
    $input: UpdateOIDCRestrictionsInput!
  ) {
    updateOIDCRestrictions(input: $input) {
      ok {
        updatedOIDCIntegration {
          id
          oidcUserAccessOnly
        }
      }
      error {
        message
      }
    }
  }
`);

const updateOIDCIntegrationFormSchema = z.object({
  tokenEndpoint: z.string().url('Must be a valid URL'),
  userinfoEndpoint: z.string().url('Must be a valid URL'),
  authorizationEndpoint: z.string().url('Must be a valid URL'),
  clientId: z.string(),
  clientSecret: z.string().optional(),
});

type UpdateOIDCIntegrationFormValues = z.infer<typeof updateOIDCIntegrationFormSchema>;

function UpdateOIDCIntegrationForm(props: {
  close: () => void;
  isOpen: boolean;
  oidcIntegration: DocumentType<typeof UpdateOIDCIntegration_OIDCIntegrationFragment>;
}): ReactElement {
  const [oidcUpdateMutation, oidcUpdateMutate] = useMutation(
    UpdateOIDCIntegrationForm_UpdateOIDCIntegrationMutation,
  );
  const [oidcRestrictionsMutation, oidcRestrictionsMutate] = useMutation(
    UpdateOIDCIntegrationForm_UpdateOIDCRestrictionsMutation,
  );
  const { toast } = useToast();

  const form = useForm<UpdateOIDCIntegrationFormValues>({
    resolver: zodResolver(updateOIDCIntegrationFormSchema),
    defaultValues: {
      tokenEndpoint: props.oidcIntegration.tokenEndpoint,
      userinfoEndpoint: props.oidcIntegration.userinfoEndpoint,
      authorizationEndpoint: props.oidcIntegration.authorizationEndpoint,
      clientId: props.oidcIntegration.clientId,
      clientSecret: '',
    },
    mode: 'onChange',
  });

  async function onSubmit(data: UpdateOIDCIntegrationFormValues) {
    const result = await oidcUpdateMutate({
      input: {
        oidcIntegrationId: props.oidcIntegration.id,
        tokenEndpoint: data.tokenEndpoint,
        userinfoEndpoint: data.userinfoEndpoint,
        authorizationEndpoint: data.authorizationEndpoint,
        clientId: data.clientId,
        clientSecret: data.clientSecret === '' ? undefined : data.clientSecret,
      },
    });

    if (result.error) {
      toast({
        title: 'Failed to update OIDC integration',
        description: result.error.message,
        variant: 'destructive',
      });
      return;
    }

    if (result.data?.updateOIDCIntegration.ok) {
      props.close();
      form.reset();
    }
  }

  const onOidcUserAccessOnlyChange = async (oidcUserAccessOnly: boolean) => {
    if (oidcRestrictionsMutation.fetching) {
      return;
    }

    try {
      toast({
        title: 'Updating OIDC restrictions...',
        variant: 'default',
      });
      const result = await oidcRestrictionsMutate({
        input: {
          oidcIntegrationId: props.oidcIntegration.id,
          oidcUserAccessOnly,
        },
      });

      if (result.data?.updateOIDCRestrictions.ok) {
        toast({
          title: 'OIDC restrictions updated successfully',
          description: oidcUserAccessOnly
            ? 'Only OIDC users can now access the organization'
            : 'Access to the organization is no longer restricted to OIDC users',
        });
      } else {
        toast({
          title: 'Failed to update OIDC restrictions',
          description: result.data?.updateOIDCRestrictions.error?.message ?? result.error?.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Failed to update OIDC restrictions',
        description: String(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={props.isOpen} onOpenChange={props.close}>
      <DialogContent className="flex min-h-[600px] w-[960px] max-w-none">
        <div className={cn(classes.container, 'flex-1')}>
          <div className="flex gap-x-5">
            <div className="flex-1">
              <div className="flex flex-col gap-y-5">
                <div className={cn(classes.container, 'flex flex-col gap-y-4')}>
                  <div>
                    <div className="text-lg font-medium">OIDC Provider Instructions</div>
                    <p className="text-muted-foreground text-sm">
                      Configure your OIDC provider with the following settings
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-2">
                      <Label>Sign-in redirect URI</Label>
                      <CopyInput
                        id="sing-in-redirect-uri"
                        value={`${env.appBaseUrl}/auth/callback/oidc`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Sign-out redirect URI</Label>
                      <CopyInput id="sign-put-redirect-uri" value={`${env.appBaseUrl}/logout`} />
                    </div>
                    <div className="space-y-2">
                      <Label>Your users can login to the organization via </Label>
                      <CopyInput
                        id="sign-in-uri"
                        value={`${env.appBaseUrl}/auth/oidc?id=${props.oidcIntegration.id}`}
                      />
                    </div>
                  </div>
                </div>

                <Separator orientation="horizontal" />

                <div className="space-y-5">
                  <div className="text-lg font-medium">Restrictions</div>
                  <div>
                    <div className="flex items-center justify-between space-x-4">
                      <div className="flex flex-col space-y-1 text-sm font-medium leading-none">
                        <p>OIDC-Only Access</p>
                        <p className="text-muted-foreground text-xs font-normal leading-snug">
                          Restricts organization access to only authenticated OIDC accounts.
                          <br />
                          <span className="font-medium">
                            Existing non-OIDC members will keep their access.
                          </span>
                        </p>
                      </div>
                      <Switch
                        checked={props.oidcIntegration.oidcUserAccessOnly}
                        onCheckedChange={onOidcUserAccessOnlyChange}
                        disabled={oidcRestrictionsMutation.fetching}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator orientation="vertical" />

            <Form {...form}>
              <form
                className={cn(classes.container, 'flex flex-1 flex-col gap-y-4')}
                onSubmit={form.handleSubmit(onSubmit)}
              >
                <div>
                  <div className="text-lg font-medium">Properties</div>
                  <p className="text-muted-foreground text-sm">
                    Configure your OIDC provider with the following settings
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="tokenEndpoint"
                      render={({ field }) => {
                        return (
                          <FormItem>
                            <FormLabel>Token Endpoint</FormLabel>
                            <FormControl>
                              <Input placeholder="OAuth Token Endpoint API" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="userinfoEndpoint"
                      render={({ field }) => {
                        return (
                          <FormItem>
                            <FormLabel>User Info Endpoint</FormLabel>
                            <FormControl>
                              <Input placeholder="OAuth User Info Endpoint API" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="authorizationEndpoint"
                      render={({ field }) => {
                        return (
                          <FormItem>
                            <FormLabel>Authorization Endpoint</FormLabel>
                            <FormControl>
                              <Input placeholder="OAuth Authorization Endpoint API" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="clientId"
                      render={({ field }) => {
                        return (
                          <FormItem>
                            <FormLabel>Client ID</FormLabel>
                            <FormControl>
                              <Input placeholder="Client ID" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="clientSecret"
                      render={({ field }) => {
                        return (
                          <FormItem>
                            <FormLabel>Client Secret</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={
                                  'Keep old value. (Ending with ' +
                                  props.oidcIntegration.clientSecretPreview.substring(
                                    props.oidcIntegration.clientSecretPreview.length - 4,
                                  ) +
                                  ')'
                                }
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>
                  <div className="space-x-2 text-right">
                    <Button
                      variant="outline"
                      onClick={ev => {
                        ev.preventDefault();
                        props.close();
                        form.reset();
                      }}
                      tabIndex={0}
                    >
                      Close
                    </Button>
                    <Button type="submit" disabled={oidcUpdateMutation.fetching}>
                      Save
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </div>
        </div>
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
