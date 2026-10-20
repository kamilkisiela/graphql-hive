import { ReactElement, ReactNode } from 'react';
import { PlusIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'urql';
import { LayoutContent } from '@/components/layouts/layout-content';
import { SecondaryNavigation } from '@/components/navigation/secondary-navigation';
import {
  CreateProjectForm,
  CreateProjectFormSchema,
  type CreateProjectFormValues,
} from '@/components/project/create-project-form';
import { NotFound } from '@/components/ui/not-found/not-found';
import { Button } from '@/components/ui/primitives/button/button';
import { Dialog } from '@/components/ui/primitives/overlays/dialog/dialog';
import { useToast } from '@/components/ui/primitives/toast/toast';
import { graphql } from '@/gql';
import { ProjectType } from '@/gql/graphql';
import { getIsStripeEnabled } from '@/lib/billing/stripe-public-key';
import { useSlugs, useToggle } from '@/lib/hooks';
import { useLastVisitedOrganizationWriter } from '@/lib/last-visited-org';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from '@tanstack/react-router';
import { ProPlanBilling } from '../organization/billing/ProPlanBillingWarm';
import { RateLimitWarn } from '../organization/billing/RateLimitWarn';
import { QueryError } from '../ui/query-error';
import { OrganizationLayoutQuery } from './queries';
import * as styles from './organization.css';

export function OrganizationLayout({ children }: { children: ReactNode }): ReactElement | null {
  const { organizationSlug } = useSlugs('organization');
  const [isModalOpen, toggleModalOpen] = useToggle();
  const [query] = useQuery({
    query: OrganizationLayoutQuery,
    variables: { organizationSlug },
    requestPolicy: 'cache-first',
  });

  const currentOrganization = query.data?.organizationBySlug;
  useLastVisitedOrganizationWriter(currentOrganization?.slug);

  if (query.error) {
    return <QueryError error={query.error} organizationSlug={organizationSlug} />;
  }

  // Only show the null state state if the query has finished fetching and data is not stale
  // This prevents showing null state when switching between orgs with cached data
  const shouldShowNoOrg = !query.fetching && !query.stale && !currentOrganization;

  return (
    <>
      <SecondaryNavigation
        loading={!currentOrganization}
        links={
          currentOrganization
            ? [
                {
                  label: 'Overview',
                  to: '/$organizationSlug',
                  params: { organizationSlug: currentOrganization.slug },
                  exact: true,
                },
                {
                  label: 'Members',
                  visible: currentOrganization.viewerCanSeeMembers,
                  to: '/$organizationSlug/view/members',
                  params: { organizationSlug: currentOrganization.slug },
                },
                {
                  label: 'Settings',
                  visible:
                    currentOrganization.viewerCanAccessSettings ||
                    currentOrganization.viewerCanManageAccessTokens ||
                    currentOrganization.viewerCanManagePersonalAccessTokens,
                  to: '/$organizationSlug/view/settings',
                  params: { organizationSlug: currentOrganization.slug },
                },
                {
                  label: 'Support',
                  visible: currentOrganization.viewerCanManageSupportTickets,
                  to: '/$organizationSlug/view/support',
                  params: { organizationSlug: currentOrganization.slug },
                },
                {
                  label: 'Subscription',
                  visible: getIsStripeEnabled() && currentOrganization.viewerCanDescribeBilling,
                  to: '/$organizationSlug/view/subscription',
                  params: { organizationSlug: currentOrganization.slug },
                },
              ]
            : []
        }
        actions={
          currentOrganization?.viewerCanCreateProject ? (
            <>
              <Button onClick={toggleModalOpen} variant="link" data-cy="new-project-button">
                <span className={styles.organizationLayoutSpan}>
                  <PlusIcon size={16} className={styles.organizationLayoutPlusIcon} />
                  New project
                </span>
              </Button>
              <CreateProjectModal
                organizationSlug={organizationSlug}
                isOpen={isModalOpen}
                toggleModalOpen={toggleModalOpen}
              />
            </>
          ) : null
        }
      />
      {currentOrganization ? (
        <div className={styles.organizationLayoutDiv}>
          <ProPlanBilling organization={currentOrganization} />
          <RateLimitWarn organization={currentOrganization} />
        </div>
      ) : null}

      {shouldShowNoOrg ? (
        <LayoutContent>
          <NotFound
            title="Organization not found"
            description="Use the empty dropdown in the header to select an organization to which you have access."
            showBackButton={false}
          />
        </LayoutContent>
      ) : (
        children
      )}
    </>
  );
}

export const CreateProjectMutation = graphql(`
  mutation CreateProject_CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      ok {
        createdProject {
          id
          slug
        }
        createdTargets {
          id
          slug
        }
        updatedOrganization {
          id
        }
      }
      error {
        message
        inputErrors {
          slug
        }
      }
    }
  }
`);

function CreateProjectModal(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationSlug: string;
}) {
  const [_, mutate] = useMutation(CreateProjectMutation);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<CreateProjectFormValues>({
    mode: 'onChange',
    resolver: zodResolver(CreateProjectFormSchema),
    defaultValues: {
      projectSlug: '',
      projectType: ProjectType.Single,
    },
  });

  async function onSubmit(values: CreateProjectFormValues) {
    const { data, error } = await mutate({
      input: {
        organization: {
          bySelector: {
            organizationSlug: props.organizationSlug,
          },
        },
        slug: values.projectSlug,
        type: values.projectType,
      },
    });
    if (data?.createProject.ok) {
      props.toggleModalOpen();
      void router.navigate({
        to: '/$organizationSlug/$projectSlug',
        params: {
          organizationSlug: props.organizationSlug,
          projectSlug: data.createProject.ok.createdProject.slug,
        },
      });
    } else if (data?.createProject.error?.inputErrors.slug) {
      form.setError('projectSlug', {
        message: data?.createProject.error?.inputErrors.slug,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to create project',
        description: error?.message || data?.createProject.error?.message,
      });
    }
  }

  return (
    <Dialog
      open={props.isOpen}
      onOpenChange={props.toggleModalOpen}
      // The form clears once the close transition has finished, rather than on toggle, which
      // would blank it mid-fade, or by remounting, which would skip the transitions.
      onOpenChangeComplete={open => {
        if (!open) {
          form.reset();
        }
      }}
      width="lg"
      title="Create a project"
      description={
        <>
          A Hive <span className={styles.createProjectModalSpan}>project</span> represents a{' '}
          <span className={styles.createProjectModalSpan2}>GraphQL API</span> running a GraphQL
          schema.
        </>
      }
    >
      <CreateProjectForm form={form} onSubmit={onSubmit} />
    </Dialog>
  );
}
