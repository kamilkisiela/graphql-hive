import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'urql';
import { SlugForm, slugFormSchema, type SlugFormValues } from '@/components/common/slug-form';
import { LayoutContent } from '@/components/layouts/layout-content';
import {
  AuditLogsForm,
  AuditLogsFormSchema,
  type AuditLogsFormValues,
} from '@/components/organization/settings/audit-logs-form';
import { TransferOrganizationOwnershipModal } from '@/components/organization/settings/transfer-ownership-dialog';
import { PolicySettings } from '@/components/policy/policy-settings';
import { GitHubIcon, SlackIcon } from '@/components/ui/brand-icon';
import { Meta } from '@/components/ui/meta';
import { Navigation } from '@/components/ui/navigation/navigation';
import {
  PageLayout,
  PageLayoutContent,
  SubPageLayout,
  SubPageLayoutHeader,
} from '@/components/ui/page-content-layout';
import { Button } from '@/components/ui/primitives/button/button';
import { Checkbox } from '@/components/ui/primitives/checkbox/checkbox';
import { AlertDialog } from '@/components/ui/primitives/overlays/alert-dialog/alert-dialog';
import { Dialog } from '@/components/ui/primitives/overlays/dialog/dialog';
import { useToast } from '@/components/ui/primitives/toast/toast';
import { QueryError } from '@/components/ui/query-error';
import { ResourceDetails } from '@/components/ui/resource-details';
import { env } from '@/env/frontend';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useSlugs, useToggle } from '@/lib/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { Outlet, useRouter } from '@tanstack/react-router';

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

const GitHubIntegrationSection_OrganizationFragment = graphql(`
  fragment GitHubIntegrationSection_OrganizationFragment on Organization {
    id
    hasGitHubIntegration
    slug
  }
`);

function GitHubIntegrationSection(props: {
  organization: FragmentType<typeof GitHubIntegrationSection_OrganizationFragment>;
}) {
  const [deleteGitHubMutation, deleteGitHub] = useMutation(DeleteGitHubIntegrationMutation);
  const organization = useFragment(
    GitHubIntegrationSection_OrganizationFragment,
    props.organization,
  );

  return organization.hasGitHubIntegration ? (
    <div className="flex flex-row justify-start gap-3">
      <Button
        variant="destructive"
        disabled={deleteGitHubMutation.fetching}
        onClick={async () => {
          await deleteGitHub({
            input: {
              organizationSlug: organization.slug,
            },
          });
        }}
      >
        <GitHubIcon className="mr-2" />
        Disconnect GitHub
      </Button>
      <Button
        variant="destructive"
        anchor={{ href: `${env.graphqlPublicOrigin}/api/github/connect/${organization.slug}` }}
      >
        Adjust permissions
      </Button>
    </div>
  ) : (
    <Button anchor={{ href: `${env.graphqlPublicOrigin}/api/github/connect/${organization.slug}` }}>
      <GitHubIcon className="mr-2" />
      Connect GitHub
    </Button>
  );
}

const SlackIntegrationSection_OrganizationFragment = graphql(`
  fragment SlackIntegrationSection_OrganizationFragment on Organization {
    id
    hasSlackIntegration
    slug
  }
`);

function SlackIntegrationSection(props: {
  organization: FragmentType<typeof SlackIntegrationSection_OrganizationFragment>;
}) {
  const [deleteSlackMutation, deleteSlack] = useMutation(DeleteSlackIntegrationMutation);
  const organization = useFragment(
    SlackIntegrationSection_OrganizationFragment,
    props.organization,
  );

  return organization.hasSlackIntegration ? (
    <Button
      variant="destructive"
      disabled={deleteSlackMutation.fetching}
      onClick={async () => {
        await deleteSlack({
          input: {
            organizationSlug: organization.slug,
          },
        });
      }}
    >
      <SlackIcon className="mr-2" />
      Disconnect Slack
    </Button>
  ) : (
    <Button anchor={{ href: `${env.graphqlPublicOrigin}/api/slack/connect/${organization.slug}` }}>
      <SlackIcon className="mr-2" />
      Connect Slack
    </Button>
  );
}

const UpdateOrganizationSlugMutation = graphql(`
  mutation Settings_UpdateOrganizationSlug($input: UpdateOrganizationSlugInput!) {
    updateOrganizationSlug(input: $input) {
      ok {
        updatedOrganizationPayload {
          selector {
            organizationSlug
          }
          organization {
            id
            slug
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
    slug
    viewerCanDelete
    viewerCanTransferOwnership
    viewerCanModifySlug
    viewerCanManageOIDCIntegration
    viewerCanModifySlackIntegration
    viewerCanModifyGitHubIntegration
    viewerCanExportAuditLogs
    ...TransferOrganizationOwnershipModal_OrganizationFragment
    ...GitHubIntegrationSection_OrganizationFragment
    ...SlackIntegrationSection_OrganizationFragment
  }
`);

const OrganizationSettingsContent = (props: {
  organization: FragmentType<typeof SettingsPageRenderer_OrganizationFragment>;
}) => {
  const { organizationSlug } = useSlugs('organization');
  const organization = useFragment(SettingsPageRenderer_OrganizationFragment, props.organization);
  const router = useRouter();
  const [isDeleteModalOpen, toggleDeleteModalOpen] = useToggle();
  const [isTransferModalOpen, toggleTransferModalOpen] = useToggle();
  const [transferSession, setTransferSession] = useState(0);
  const [isAuditLogsModalOpen, toggleAuditLogsModalOpen] = useToggle();
  const { toast } = useToast();

  const [_slugMutation, slugMutate] = useMutation(UpdateOrganizationSlugMutation);

  const slugForm = useForm({
    mode: 'all',
    resolver: zodResolver(slugFormSchema('Organization')),
    defaultValues: {
      slug: organization.slug,
    },
  });

  const onSlugFormSubmit = useCallback(
    async (data: SlugFormValues) => {
      try {
        const result = await slugMutate({
          input: {
            organizationSlug,
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
            to: '/$organizationSlug/view/settings',
            params: {
              organizationSlug:
                result.data.updateOrganizationSlug.ok.updatedOrganizationPayload.organization.slug,
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
    [slugMutate, organizationSlug],
  );

  return (
    <div className="space-y-12">
      <ResourceDetails id={organization.id} label="Organization ID" />
      {organization.viewerCanModifySlug && (
        <>
          <SubPageLayoutHeader
            subPageTitle="Organization Slug"
            description={
              <p>
                This is your organization's URL namespace on Hive Console. Changing it{' '}
                <span className="font-bold">will invalidate</span> any existing links to your
                organization.
              </p>
            }
            docsLink={{
              href: '/schema-registry/management/organizations#change-slug-of-organization',
              text: 'Read more in the documentation',
            }}
          />
          <SlugForm
            form={slugForm}
            onSubmit={onSlugFormSubmit}
            prefixText={`${env.appBaseUrl.replace(/https?:\/\//i, '')}/`}
          />
        </>
      )}

      {organization.viewerCanModifySlackIntegration && (
        <SubPageLayout>
          <SubPageLayoutHeader
            subPageTitle="Slack Integration"
            description="Link your Hive organization with Slack for schema change notifications."
            docsLink={{
              href: '/schema-registry/management/organizations#slack',
              text: 'Learn more.',
            }}
          />
          <SlackIntegrationSection organization={organization} />
        </SubPageLayout>
      )}

      {organization.viewerCanModifyGitHubIntegration && (
        <SubPageLayout>
          <SubPageLayoutHeader
            subPageTitle="GitHub Integration"
            description="Link your Hive organization with GitHub."
            docsLink={{
              href: '/schema-registry/management/organizations#github',
              text: 'Learn more.',
            }}
          />
          <GitHubIntegrationSection organization={organization} />
        </SubPageLayout>
      )}

      {organization.viewerCanTransferOwnership && (
        <SubPageLayout>
          <SubPageLayoutHeader
            subPageTitle="Transfer Ownership"
            description={
              <p>
                <strong>You are currently the owner of the organization.</strong> You can transfer
                the organization to another member of the organization, or to an external user.
              </p>
            }
            docsLink={{
              href: '/schema-registry/management/organizations#transfer-ownership',
              text: 'Learn more about the process',
            }}
          />
          <Button variant="destructive" onClick={toggleTransferModalOpen}>
            Transfer Ownership
          </Button>
          <TransferOrganizationOwnershipModal
            key={transferSession}
            isOpen={isTransferModalOpen}
            toggleModalOpen={toggleTransferModalOpen}
            onOpenChangeComplete={open => {
              if (!open) {
                setTransferSession(s => s + 1);
              }
            }}
            organization={organization}
          />
        </SubPageLayout>
      )}

      {organization.viewerCanDelete && (
        <SubPageLayout>
          <SubPageLayoutHeader
            subPageTitle="Delete Organization"
            description={
              <p>
                Deleting an organization will delete all the projects, targets, schemas and data
                associated with it. <strong>This action is not reversible!</strong>
              </p>
            }
            docsLink={{
              href: '/schema-registry/management/organizations#delete-an-organization',
              text: 'You can find more information about this process in the documentation',
            }}
          />
          <Button variant="destructive" onClick={toggleDeleteModalOpen}>
            Delete Organization
          </Button>
          <DeleteOrganizationModal
            isOpen={isDeleteModalOpen}
            toggleModalOpen={toggleDeleteModalOpen}
          />
        </SubPageLayout>
      )}

      {organization.viewerCanExportAuditLogs && (
        <SubPageLayout>
          <SubPageLayoutHeader
            subPageTitle="Audit Logs"
            description="View a history of changes made to the organization settings."
            docsLink={{
              href: '/schema-registry/management/audit-logs',
              text: 'Learn more',
            }}
          />
          <Button onClick={toggleAuditLogsModalOpen}>Export Audit Logs</Button>
          <AuditLogsOrganizationModal
            isOpen={isAuditLogsModalOpen}
            toggleModalOpen={toggleAuditLogsModalOpen}
          />
        </SubPageLayout>
      )}
    </div>
  );
};

const OrganizationPolicySettings_OrganizationFragment = graphql(`
  fragment OrganizationPolicySettings_OrganizationFragment on Organization {
    id
    slug
    schemaPolicy {
      id
      updatedAt
      ...PolicySettings_SchemaPolicyFragment
    }
    viewerCanModifySchemaPolicy
  }
`);

const UpdateSchemaPolicyForOrganization = graphql(`
  mutation UpdateSchemaPolicyForOrganization(
    $selector: OrganizationSelectorInput!
    $policy: SchemaPolicyInput!
    $allowOverrides: Boolean!
  ) {
    updateSchemaPolicyForOrganization(
      selector: $selector
      policy: $policy
      allowOverrides: $allowOverrides
    ) {
      error {
        message
      }
      ok {
        organization {
          id
          schemaPolicy {
            id
            updatedAt
            allowOverrides
            ...PolicySettings_SchemaPolicyFragment
          }
        }
      }
    }
  }
`);

function OrganizationPolicySettings(props: {
  organization: FragmentType<typeof OrganizationPolicySettings_OrganizationFragment>;
}) {
  const [mutation, mutate] = useMutation(UpdateSchemaPolicyForOrganization);
  const { toast } = useToast();

  const currentOrganization = useFragment(
    OrganizationPolicySettings_OrganizationFragment,
    props.organization,
  );

  return (
    <SubPageLayout>
      <SubPageLayoutHeader
        subPageTitle="Rules"
        description="At the organizational level, policies can be defined to affect all projects and targets. At the project level, policies can be overridden or extended."
        docsLink={{
          href: '/features/schema-policy',
          text: 'Learn more',
        }}
      />
      <PolicySettings
        saving={mutation.fetching}
        error={
          mutation.error?.message || mutation.data?.updateSchemaPolicyForOrganization.error?.message
        }
        onSave={
          currentOrganization.viewerCanModifySchemaPolicy
            ? async (newPolicy, allowOverrides) => {
                await mutate({
                  selector: {
                    organizationSlug: currentOrganization.slug,
                  },
                  policy: newPolicy,
                  allowOverrides,
                })
                  .then(result => {
                    if (result.data?.updateSchemaPolicyForOrganization.error || result.error) {
                      toast({
                        variant: 'destructive',
                        title: 'Error',
                        description:
                          result.data?.updateSchemaPolicyForOrganization.error?.message ||
                          result.error?.message,
                      });
                    } else {
                      toast({
                        variant: 'default',
                        title: 'Success',
                        description: 'Policy updated successfully',
                      });
                    }
                  })
                  .catch();
              }
            : null
        }
        currentState={currentOrganization.schemaPolicy}
      >
        {({ allowOverrides, setAllowOverrides }) => (
          <div className="flex items-center pt-2 pl-1">
            <Checkbox
              id="allowOverrides"
              checked={allowOverrides}
              value="allowOverrides"
              onCheckedChange={setAllowOverrides}
              disabled={!currentOrganization.viewerCanModifySchemaPolicy}
            />
            <label htmlFor="allowOverrides" className="ml-2 inline-block text-sm text-fg-default">
              Allow projects to override or disable rules
            </label>
          </div>
        )}
      </PolicySettings>
    </SubPageLayout>
  );
}

export const OrganizationSettingsPageQuery = graphql(`
  query OrganizationSettingsPageQuery($organizationSlug: String!) {
    organization: organizationBySlug(organizationSlug: $organizationSlug) {
      ...SettingsPageRenderer_OrganizationFragment
      ...OrganizationPolicySettings_OrganizationFragment
      viewerCanAccessSettings
      viewerCanManageAccessTokens
      viewerCanManagePersonalAccessTokens
      viewerCanManageOIDCIntegration
    }
  }
`);

export type OrganizationSettingsSectionId =
  | 'general'
  | 'policy'
  | 'sso'
  | 'access-tokens'
  | 'personal-access-tokens';

type Section = {
  id: OrganizationSettingsSectionId;
  label: string;
  to: `/$organizationSlug/view/settings${'' | `/${Exclude<OrganizationSettingsSectionId, 'general'>}`}`;
  exact?: boolean;
};

// The sections in nav order. The bare URL is General.
const sections: readonly Section[] = [
  { id: 'general', label: 'General', to: '/$organizationSlug/view/settings', exact: true },
  { id: 'policy', label: 'Policy', to: '/$organizationSlug/view/settings/policy' },
  { id: 'sso', label: 'SSO / SCIM', to: '/$organizationSlug/view/settings/sso' },
  {
    id: 'access-tokens',
    label: 'Access Tokens',
    to: '/$organizationSlug/view/settings/access-tokens',
  },
  {
    id: 'personal-access-tokens',
    label: 'Personal Access Tokens',
    to: '/$organizationSlug/view/settings/personal-access-tokens',
  },
];

// The sections this viewer may open; the route loaders and the nav both read it.
export function organizationSettingsSections(organization: {
  viewerCanAccessSettings: boolean;
  viewerCanManageOIDCIntegration: boolean;
  viewerCanManageAccessTokens: boolean;
  viewerCanManagePersonalAccessTokens: boolean;
}) {
  const ids = new Set<OrganizationSettingsSectionId>(['policy']);
  if (organization.viewerCanAccessSettings) {
    ids.add('general');
  }
  if (organization.viewerCanManageOIDCIntegration) {
    ids.add('sso');
  }
  if (organization.viewerCanManageAccessTokens) {
    ids.add('access-tokens');
  }
  if (organization.viewerCanManagePersonalAccessTokens) {
    ids.add('personal-access-tokens');
  }
  return sections.filter(section => ids.has(section.id));
}

export function OrganizationSettingsPage() {
  const slugs = useSlugs('organization');
  const { organizationSlug } = slugs;
  const [query] = useQuery({ query: OrganizationSettingsPageQuery, variables: slugs });
  const currentOrganization = query.data?.organization;
  const visible = currentOrganization ? organizationSettingsSections(currentOrganization) : [];

  if (query.error) {
    return <QueryError organizationSlug={organizationSlug} error={query.error} />;
  }

  return (
    <>
      <Meta title="Organization settings" />
      {currentOrganization ? (
        <LayoutContent className="flex flex-col gap-y-10">
          <PageLayout>
            <Navigation
              aria-label="Settings"
              variant="list"
              items={visible.map(section => ({
                label: section.label,
                to: section.to,
                params: slugs,
                exact: section.exact,
                attrs: { 'data-cy': `link-${section.id}` },
              }))}
            />
            <PageLayoutContent>
              <div className="space-y-12">
                <Outlet />
              </div>
            </PageLayoutContent>
          </PageLayout>
        </LayoutContent>
      ) : null}
    </>
  );
}

export function OrganizationSettingsGeneralSection() {
  const [query] = useQuery({
    query: OrganizationSettingsPageQuery,
    variables: useSlugs('organization'),
  });
  const currentOrganization = query.data?.organization;
  if (!currentOrganization) {
    return null;
  }
  return <OrganizationSettingsContent organization={currentOrganization} />;
}

export function OrganizationSettingsPolicySection() {
  const [query] = useQuery({
    query: OrganizationSettingsPageQuery,
    variables: useSlugs('organization'),
  });
  const currentOrganization = query.data?.organization;
  if (!currentOrganization) {
    return null;
  }
  return <OrganizationPolicySettings organization={currentOrganization} />;
}

export const DeleteOrganizationDocument = graphql(`
  mutation deleteOrganization($selector: OrganizationSelectorInput!) {
    deleteOrganization(selector: $selector) {
      selector {
        organizationSlug
      }
      organization {
        __typename
        id
      }
    }
  }
`);

export function DeleteOrganizationModal(props: { isOpen: boolean; toggleModalOpen: () => void }) {
  const { organizationSlug } = useSlugs('organization');
  const [, mutate] = useMutation(DeleteOrganizationDocument);
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    const { error } = await mutate({
      selector: {
        organizationSlug,
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
    <AlertDialog
      open={props.isOpen}
      onOpenChange={props.toggleModalOpen}
      title="Delete organization"
      description={
        <>
          Every project created under this organization will be deleted as well.
          <br />
          <strong>This action is irreversible!</strong>
        </>
      }
      confirm={{ label: 'Delete', variant: 'destructive', onClick: props.handleDelete }}
    />
  );
}

const AuditLogsOrganizationSettingsPageMutation = graphql(`
  mutation AuditLogsOrganizationSettingsPageMutation($input: ExportOrganizationAuditLogInput!) {
    exportOrganizationAuditLog(input: $input) {
      ok {
        url
      }
      error {
        message
      }
    }
  }
`);

function AuditLogsOrganizationModal(props: { isOpen: boolean; toggleModalOpen: () => void }) {
  const { organizationSlug: organization } = useSlugs('organization');
  const { toast } = useToast();
  const [, exportAuditLogs] = useMutation(AuditLogsOrganizationSettingsPageMutation);

  const today = new Date().toISOString().split('T')[0];
  const lastYear = new Date(new Date().setFullYear(new Date().getFullYear() - 1))
    .toISOString()
    .split('T')[0];

  const form = useForm<AuditLogsFormValues>({
    mode: 'onSubmit',
    resolver: zodResolver(AuditLogsFormSchema),
    defaultValues: {
      startDate: lastYear,
      endDate: today,
    },
  });

  async function onSubmit(data: AuditLogsFormValues) {
    const formattedStartDate = new Date(data.startDate).toISOString();
    const formattedEndDate = new Date(data.endDate).toISOString();

    const result = await exportAuditLogs({
      input: {
        selector: {
          organizationSlug: organization,
        },
        filter: {
          startDate: formattedStartDate,
          endDate: formattedEndDate,
        },
      },
    });

    if (result.data?.exportOrganizationAuditLog.error) {
      toast({
        title: 'Failed to start audit logs report',
        description: result.data.exportOrganizationAuditLog.error.message,
        variant: 'destructive',
      });
      return;
    }

    props.toggleModalOpen();
    form.reset();
    toast({
      title: 'Audit logs report generated',
      description: 'The audit logs report has been generated and will be sent to your email.',
    });
  }

  return (
    <Dialog
      open={props.isOpen}
      onOpenChange={props.toggleModalOpen}
      title="Audit Logs"
      description="Select a date range to generate an audit logs report."
    >
      <AuditLogsForm form={form} onSubmit={onSubmit} />
    </Dialog>
  );
}
