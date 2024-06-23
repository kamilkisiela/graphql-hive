import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
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
import { DocsLink } from '@/components/ui/docs-note';
import { Meta } from '@/components/ui/meta';
import { DeleteOrganizationModal } from '@/components/ui/modal/delete-organization';
import { TransferOrganizationOwnershipModal } from '@/components/ui/modal/transfer-organization-ownership';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { useToast } from '@/components/ui/use-toast';
import { GitHubIcon, SlackIcon } from '@/components/v2/icon';
import { Input } from '@/components/v2/input';
import { Tag } from '@/components/v2/tag';
import { env } from '@/env/frontend';
import { FragmentType, graphql, useFragment } from '@/gql';
import {
  canAccessOrganization,
  OrganizationAccessScope,
  useOrganizationAccess,
} from '@/lib/access/organization';
import { useToggle } from '@/lib/hooks';
import { useRouter } from '@tanstack/react-router';

const Integrations_CheckIntegrationsQuery = graphql(`
  query Integrations_CheckIntegrationsQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        id
        viewerCanManageOIDCIntegration
        ...OIDCIntegrationSection_OrganizationFragment
        id
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

const SettingsPageRenderer_OrganizationFragment = graphql(`
  fragment SettingsPageRenderer_OrganizationFragment on Organization {
    id
    name
    me {
      ...CanAccessOrganization_MemberFragment
      isOwner
    }
    ...DeleteOrganizationModal_OrganizationFragment
    ...TransferOrganizationOwnershipModal_OrganizationFragment
  }
`);

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

  const [mutation, mutate] = useMutation(UpdateOrganizationNameMutation);

  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } =
    useFormik({
      enableReinitialize: true,
      initialValues: {
        name: organization?.name,
      },
      validationSchema: Yup.object().shape({
        name: Yup.string().required('Organization name is required'),
      }),
      onSubmit: values =>
        mutate({
          input: {
            organization: props.organizationId,
            name: values.name,
          },
        }).then(result => {
          if (result.data?.updateOrganizationName?.ok) {
            toast({
              variant: 'default',
              title: 'Success',
              description: 'Organization name updated',
            });

            const newOrgId =
              result.data?.updateOrganizationName?.ok.updatedOrganizationPayload.selector
                .organization;
            void router.navigate({
              to: '/$organizationId/view/settings',
              params: {
                organizationId: newOrgId,
              },
            });
          } else if (result.error || result.data?.updateOrganizationName.error) {
            toast({
              variant: 'destructive',
              title: 'Error',
              description:
                result.data?.updateOrganizationName.error?.message || result.error?.message,
            });
          }
        }),
    });

  return (
    <div>
      <div className="py-6">
        <Title>Organization Settings</Title>
        <Subtitle>Manage your organization settings and integrations.</Subtitle>
      </div>

      {hasAccess ? (
        <div className="flex flex-col gap-y-4">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardHeader>
                <CardTitle>Organization Name</CardTitle>
                <CardDescription>
                  Changing the name of your organization will also change the slug of your
                  organization URL, and will invalidate any existing links to your organization.
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
                <div className="flex gap-x-2">
                  <Input
                    placeholder="Organization name"
                    name="name"
                    value={values.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={isSubmitting}
                    isInvalid={touched.name && !!errors.name}
                    className="w-96"
                  />
                </div>
                {touched.name && (errors.name || mutation.error) && (
                  <div className="mt-2 text-red-500">{errors.name || mutation.error?.message}</div>
                )}
                {mutation.data?.updateOrganizationName?.error && (
                  <div className="mt-2 text-red-500">
                    {mutation.data?.updateOrganizationName.error.message}
                  </div>
                )}
                {mutation.error && (
                  <div>{mutation.error.graphQLErrors[0]?.message ?? mutation.error.message}</div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button disabled={isSubmitting} className="px-10" type="submit">
                  Save
                </Button>
              </CardFooter>
            </Card>
          </form>

          {canAccessOrganization(OrganizationAccessScope.Integrations, organization.me) && (
            <Card>
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
                  organization={organization}
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
