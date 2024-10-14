import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'urql';
import { z } from 'zod';
import { OrganizationLayout, Page } from '@/components/layouts/organization';
import { OIDCIntegrationSection } from '@/components/organization/settings/oidc-integration-section';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DocsLink } from '@/components/ui/docs-note';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { GitHubIcon, SlackIcon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { useToast } from '@/components/ui/use-toast';
import { TransferOrganizationOwnershipModal } from '@/components/v2/modals';
import { Tag } from '@/components/v2/tag';
import { env } from '@/env/frontend';
import { FragmentType, graphql, useFragment } from '@/gql';
import {
  canAccessOrganization,
  OrganizationAccessScope,
  useOrganizationAccess,
} from '@/lib/access/organization';
import { useToggle } from '@/lib/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from '@tanstack/react-router';

const Integrations_CheckIntegrationsQuery = graphql(`
  query Integrations_CheckIntegrationsQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        id
        viewerCanManageOIDCIntegration
        ...OIDCIntegrationSection_OrganizationFragment
        hasSlackIntegration
        hasGitHubIntegration
      }
    }
    isGitHubIntegrationFeatureEnabled
  }
`);

const DeleteSlackIntegrationMutation = graphql(`
  mutation Integrations_DeleteSlackIntegration($input: OrganizationSelectorInput!) {
    deleteSlackIntegration(input: $input) {
      organization {
        id
        hasSlackIntegration
      }
    }
  }
`);

const DeleteGitHubIntegrationMutation = graphql(`
  mutation Integrations_DeleteGitHubIntegration($input: OrganizationSelectorInput!) {
    deleteGitHubIntegration(input: $input) {
      organization {
        id
        hasGitHubIntegration
      }
    }
  }
`);

function Integrations(props: { organizationId: string }) {
  const orgId = props.organizationId;

  const [checkIntegrations] = useQuery({
    query: Integrations_CheckIntegrationsQuery,
    variables: {
      selector: {
        organization: orgId,
      },
    },
  });

  const [deleteSlackMutation, deleteSlack] = useMutation(DeleteSlackIntegrationMutation);
  const [deleteGitHubMutation, deleteGitHub] = useMutation(DeleteGitHubIntegrationMutation);

  if (checkIntegrations.fetching) {
    return null;
  }

  const isGitHubIntegrationFeatureEnabled =
    checkIntegrations.data?.isGitHubIntegrationFeatureEnabled;
  const hasGitHubIntegration =
    checkIntegrations.data?.organization?.organization.hasGitHubIntegration === true;
  const hasSlackIntegration =
    checkIntegrations.data?.organization?.organization.hasSlackIntegration === true;

  return (
    <>
      {env.integrations.slack === false ? null : (
        <div className="flex items-center gap-x-4">
          {hasSlackIntegration ? (
            <Button
              variant="destructive"
              disabled={deleteSlackMutation.fetching}
              onClick={async () => {
                await deleteSlack({
                  input: {
                    organization: orgId,
                  },
                });
              }}
            >
              <SlackIcon className="mr-2" />
              Disconnect Slack
            </Button>
          ) : (
            <Button variant="secondary" asChild>
              <a href={`/api/slack/connect/${props.organizationId}`}>
                <SlackIcon className="mr-2" />
                Connect Slack
              </a>
            </Button>
          )}
          <Tag>Alerts and notifications</Tag>
        </div>
      )}
      {isGitHubIntegrationFeatureEnabled === false ? null : (
        <div className="flex items-center gap-x-4">
          <>
            {hasGitHubIntegration ? (
              <>
                <Button
                  variant="destructive"
                  disabled={deleteGitHubMutation.fetching}
                  onClick={async () => {
                    await deleteGitHub({
                      input: {
                        organization: orgId,
                      },
                    });
                  }}
                >
                  <GitHubIcon className="mr-2" />
                  Disconnect GitHub
                </Button>
                <Button variant="link" asChild>
                  <a href={`/api/github/connect/${props.organizationId}`}>Adjust permissions</a>
                </Button>
              </>
            ) : (
              <Button variant="secondary" asChild>
                <a href={`/api/github/connect/${props.organizationId}`}>
                  <GitHubIcon className="mr-2" />
                  Connect GitHub
                </a>
              </Button>
            )}
            <Tag>Allow Hive to communicate with GitHub</Tag>
          </>
        </div>
      )}
      {checkIntegrations.data?.organization?.organization.viewerCanManageOIDCIntegration ? (
        <OIDCIntegrationSection organization={checkIntegrations.data?.organization?.organization} />
      ) : null}
    </>
  );
}

const UpdateOrganizationNameMutation = graphql(`
  mutation Settings_UpdateOrganizationName($input: UpdateOrganizationNameInput!) {
    updateOrganizationName(input: $input) {
      ok {
        updatedOrganizationPayload {
          selector {
            organization
          }
          organization {
            id
            cleanId
            name
          }
        }
      }
      error {
        message
      }
    }
  }
`);

const UpdateOrganizationSlugMutation = graphql(`
  mutation Settings_UpdateOrganizationSlug($input: UpdateOrganizationSlugInput!) {
    updateOrganizationSlug(input: $input) {
      ok {
        updatedOrganizationPayload {
          selector {
            organization
          }
          organization {
            id
            cleanId
          }
        }
      }
      error {
        message
      }
    }
  }
`);

const SettingsPageRenderer_OrganizationFragment = graphql(`
  fragment SettingsPageRenderer_OrganizationFragment on Organization {
    id
    cleanId
    name
    me {
      ...CanAccessOrganization_MemberFragment
      isOwner
    }
    ...TransferOrganizationOwnershipModal_OrganizationFragment
  }
`);

const SlugFormSchema = z.object({
  slug: z
    .string({
      required_error: 'Organization slug is required',
    })
    .min(1, 'Organization slug is required')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and dashes'),
});

type SlugFormValues = z.infer<typeof SlugFormSchema>;

const NameFormSchema = z.object({
  name: z
    .string({
      required_error: 'Name is required',
    })
    .min(1, 'Name is required')
    .max(50, 'Name must be less than 50 characters'),
});

type NameFormValues = z.infer<typeof NameFormSchema>;

const SettingsPageRenderer = (props: {
  organization: FragmentType<typeof SettingsPageRenderer_OrganizationFragment>;
  organizationId: string;
}) => {
  const organization = useFragment(SettingsPageRenderer_OrganizationFragment, props.organization);
  const hasAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: organization.me,
    redirect: true,
    organizationId: props.organizationId,
  });
  const router = useRouter();
  const [isDeleteModalOpen, toggleDeleteModalOpen] = useToggle();
  const [isTransferModalOpen, toggleTransferModalOpen] = useToggle();
  const { toast } = useToast();

  const [_nameMutation, nameMutate] = useMutation(UpdateOrganizationNameMutation);
  const [_slugMutation, slugMutate] = useMutation(UpdateOrganizationSlugMutation);

  const nameForm = useForm({
    mode: 'all',
    resolver: zodResolver(NameFormSchema),
    defaultValues: {
      name: organization.name,
    },
  });

  const onNameFormSubmit = useCallback(
    async (data: NameFormValues) => {
      try {
        const result = await nameMutate({
          input: {
            organization: props.organizationId,
            name: data.name,
          },
        });

        const error = result.error || result.data?.updateOrganizationName.error;

        if (result.data?.updateOrganizationName?.ok) {
          toast({
            variant: 'default',
            title: 'Success',
            description: 'Organization name updated',
          });
        } else if (error) {
          nameForm.setError('name', error);
        }
      } catch (error) {
        console.error('error', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to update organization name',
        });
      }
    },
    [nameMutate, props.organizationId],
  );

  const slugForm = useForm({
    mode: 'all',
    resolver: zodResolver(SlugFormSchema),
    defaultValues: {
      slug: organization.cleanId,
    },
  });

  const onSlugFormSubmit = useCallback(
    async (data: SlugFormValues) => {
      try {
        const result = await slugMutate({
          input: {
            organization: props.organizationId,
            slug: data.slug,
          },
        });

        const error = result.error || result.data?.updateOrganizationSlug.error;

        if (result.data?.updateOrganizationSlug?.ok) {
          toast({
            variant: 'default',
            title: 'Success',
            description: 'Organization slug updated',
          });
          void router.navigate({
            to: '/$organizationId/view/settings',
            params: {
              organizationId:
                result.data.updateOrganizationSlug.ok.updatedOrganizationPayload.organization
                  .cleanId,
            },
          });
        } else if (error) {
          slugForm.setError('slug', error);
        }
      } catch (error) {
        console.error('error', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to update organization slug',
        });
      }
    },
    [slugMutate, props.organizationId],
  );

  return (
    <div>
      <div className="py-6">
        <Title>Organization Settings</Title>
        <Subtitle>Manage your organization settings and integrations.</Subtitle>
      </div>

      {hasAccess ? (
        <div className="flex flex-col gap-y-4">
          <Form {...nameForm}>
            <form onSubmit={nameForm.handleSubmit(onNameFormSubmit)}>
              <Card>
                <CardHeader>
                  <CardTitle>Organization Name</CardTitle>
                  <CardDescription>
                    Changing the name of your organization will{' '}
                    <span className="font-bold">not</span> change the slug of your organization URL,
                    and will <span className="font-bold">not</span> invalidate any existing links to
                    your organization.
                    <br />
                    <DocsLink
                      className="text-muted-foreground text-sm"
                      href="/management/organizations#rename-an-organization"
                    >
                      You can read more about it in the documentation
                    </DocsLink>
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <FormField
                    control={nameForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Name" className="w-80" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    disabled={nameForm.formState.isSubmitting}
                    className="px-10"
                    type="submit"
                  >
                    Save
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </Form>

          <Form {...slugForm}>
            <form onSubmit={slugForm.handleSubmit(onSlugFormSubmit)}>
              <Card>
                <CardHeader>
                  <CardTitle>Organization Slug</CardTitle>
                  <CardDescription>
                    This is your organization's URL namespace on GraphQL Hive. Changing it{' '}
                    <span className="font-bold">will</span> invalidate any existing links to your
                    organization.
                    <br />
                    <DocsLink
                      className="text-muted-foreground text-sm"
                      href="/management/organizations#change-slug-of-organization"
                    >
                      You can read more about it in the documentation
                    </DocsLink>
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <FormField
                    control={slugForm.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="flex items-center">
                            <div className="border-input text-muted-foreground h-10 rounded-md rounded-r-none border-y border-l bg-gray-900 px-3 py-2 text-sm">
                              {env.appBaseUrl.replace(/https?:\/\//i, '')}/
                            </div>
                            <Input placeholder="slug" className="w-48 rounded-l-none" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    disabled={slugForm.formState.isSubmitting}
                    className="px-10"
                    type="submit"
                  >
                    Save
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </Form>

          {canAccessOrganization(OrganizationAccessScope.Integrations, organization.me) && (
            <Card id="integrations">
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>
                  Authorize external services to make them available for your the projects under
                  this organization.
                  <br />
                  <DocsLink
                    className="text-muted-foreground text-sm"
                    href="/management/organizations#integrations"
                  >
                    You can find here instructions and full documentation for the available
                    integration
                  </DocsLink>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-y-4 text-gray-500">
                  <Integrations organizationId={props.organizationId} />
                </div>
              </CardContent>
            </Card>
          )}

          {organization.me.isOwner && (
            <Card>
              <CardHeader>
                <CardTitle>Transfer Ownership</CardTitle>
                <CardDescription>
                  <strong>You are currently the owner of the organization.</strong> You can transfer
                  the organization to another member of the organization, or to an external user.
                  <br />
                  <DocsLink
                    className="text-muted-foreground text-sm"
                    href="/management/organizations#transfer-ownership"
                  >
                    Learn more about the process
                  </DocsLink>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Button
                      variant="destructive"
                      onClick={toggleTransferModalOpen}
                      className="px-5"
                    >
                      Transfer Ownership
                    </Button>
                    <TransferOrganizationOwnershipModal
                      isOpen={isTransferModalOpen}
                      toggleModalOpen={toggleTransferModalOpen}
                      organization={organization}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {canAccessOrganization(OrganizationAccessScope.Delete, organization.me) && (
            <Card>
              <CardHeader>
                <CardTitle>Delete Organization</CardTitle>
                <CardDescription>
                  Deleting an organization will delete all the projects, targets, schemas and data
                  associated with it.
                  <br />
                  <DocsLink
                    className="text-muted-foreground text-sm"
                    href="/management/organizations#delete-an-organization"
                  >
                    <strong>This action is not reversible!</strong> You can find more information
                    about this process in the documentation
                  </DocsLink>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={toggleDeleteModalOpen} className="px-5">
                  Delete Organization
                </Button>
                <DeleteOrganizationModal
                  organizationId={props.organizationId}
                  isOpen={isDeleteModalOpen}
                  toggleModalOpen={toggleDeleteModalOpen}
                />
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
};

const OrganizationSettingsPageQuery = graphql(`
  query OrganizationSettingsPageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        ...SettingsPageRenderer_OrganizationFragment
      }
    }
  }
`);

function SettingsPageContent(props: { organizationId: string }) {
  const [query] = useQuery({
    query: OrganizationSettingsPageQuery,
    variables: {
      selector: {
        organization: props.organizationId,
      },
    },
  });

  if (query.error) {
    return <QueryError organizationId={props.organizationId} error={query.error} />;
  }

  const currentOrganization = query.data?.organization?.organization;

  return (
    <OrganizationLayout
      page={Page.Settings}
      organizationId={props.organizationId}
      className="flex flex-col gap-y-10"
    >
      {currentOrganization ? (
        <SettingsPageRenderer
          organizationId={props.organizationId}
          organization={currentOrganization}
        />
      ) : null}
    </OrganizationLayout>
  );
}

export function OrganizationSettingsPage(props: { organizationId: string }) {
  return (
    <>
      <Meta title="Organization settings" />
      <SettingsPageContent organizationId={props.organizationId} />
    </>
  );
}

export const DeleteOrganizationDocument = graphql(`
  mutation deleteOrganization($selector: OrganizationSelectorInput!) {
    deleteOrganization(selector: $selector) {
      selector {
        organization
      }
      organization {
        __typename
        id
      }
    }
  }
`);

export function DeleteOrganizationModal(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationId: string;
}) {
  const { organizationId } = props;
  const [, mutate] = useMutation(DeleteOrganizationDocument);
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    const { error } = await mutate({
      selector: {
        organization: organizationId,
      },
    });
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete organization',
        description: error.message,
      });
    } else {
      toast({
        title: 'Organization deleted',
        description: 'The organization has been successfully deleted.',
      });
      props.toggleModalOpen();
      void router.navigate({
        to: '/',
      });
    }
  };

  return (
    <DeleteOrganizationModalContent
      isOpen={props.isOpen}
      toggleModalOpen={props.toggleModalOpen}
      handleDelete={handleDelete}
    />
  );
}

export function DeleteOrganizationModalContent(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  handleDelete: () => void;
}) {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="w-4/5 max-w-[520px] md:w-3/5">
        <DialogHeader>
          <DialogTitle>Delete organization</DialogTitle>
          <DialogDescription>
            Every project created under this organization will be deleted as well.
          </DialogDescription>
          <DialogDescription>
            <span className="font-bold">This action is irreversible!</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={ev => {
              ev.preventDefault();
              props.toggleModalOpen();
            }}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={props.handleDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
