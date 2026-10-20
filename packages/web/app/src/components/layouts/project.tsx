import { ReactNode } from 'react';
import { PlusIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'urql';
import { SecondaryNavigation } from '@/components/navigation/secondary-navigation';
import {
  CreateTargetForm,
  CreateTargetFormSchema,
  type CreateTargetFormValues,
} from '@/components/target/create-target-form';
import { NotFound, resourceAccessDescription } from '@/components/ui/not-found/not-found';
import { Button } from '@/components/ui/primitives/button/button';
import { Dialog } from '@/components/ui/primitives/overlays/dialog/dialog';
import { useToast } from '@/components/ui/primitives/toast/toast';
import { graphql } from '@/gql';
import { useSlugs, useToggle } from '@/lib/hooks';
import { useLastVisitedOrganizationWriter } from '@/lib/last-visited-org';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from '@tanstack/react-router';
import { LegacyCompositionWarn } from '../project/LegacyCompositionWarn';
import { ProjectLayoutQuery } from './queries';
import * as styles from './project.css';

export function ProjectLayout({ children }: { children: ReactNode }) {
  const { organizationSlug, projectSlug } = useSlugs('project');
  const params = { organizationSlug, projectSlug };

  const [isModalOpen, toggleModalOpen] = useToggle();
  const [query] = useQuery({
    query: ProjectLayoutQuery,
    requestPolicy: 'cache-first',
    variables: params,
  });

  const currentOrganization = query.data?.organization;
  const currentProject = currentOrganization?.project;

  useLastVisitedOrganizationWriter(currentOrganization?.slug);

  return (
    <>
      {query.fetching === false &&
      query.stale === false &&
      (currentProject === null || currentOrganization === null) ? (
        <NotFound
          variants={{ layout: 'horizontal', illustration: 'connection' }}
          title="404 - This project does not seem to exist."
          description={resourceAccessDescription}
        />
      ) : (
        <>
          <SecondaryNavigation
            loading={!currentOrganization || !currentProject}
            links={
              currentOrganization && currentProject
                ? [
                    {
                      label: 'Targets',
                      to: '/$organizationSlug/$projectSlug',
                      params,
                      exact: true,
                    },
                    {
                      label: 'Alerts',
                      visible: currentProject.viewerCanModifyAlerts,
                      to: '/$organizationSlug/$projectSlug/view/alerts',
                      params,
                    },
                    {
                      label: 'Settings',
                      visible:
                        currentProject.viewerCanModifySettings ||
                        currentProject.viewerCanManageProjectAccessTokens,
                      to: '/$organizationSlug/$projectSlug/view/settings',
                      params,
                    },
                  ]
                : []
            }
            actions={
              currentProject?.viewerCanCreateTarget ? (
                <>
                  <Button onClick={toggleModalOpen} variant="link">
                    <span className={styles.projectLayoutSpan}>
                      <PlusIcon size={16} className={styles.projectLayoutPlusIcon} />
                      New target
                    </span>
                  </Button>
                  <CreateTargetModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
                </>
              ) : null
            }
          />
          {currentProject ? (
            <div className={styles.projectLayoutDiv}>
              <LegacyCompositionWarn project={currentProject} />
            </div>
          ) : null}
          {children}
        </>
      )}
    </>
  );
}

export const CreateTarget_CreateTargetMutation = graphql(`
  mutation CreateTarget_CreateTarget($input: CreateTargetInput!) {
    createTarget(input: $input) {
      ok {
        selector {
          organizationSlug
          projectSlug
          targetSlug
        }
        createdTarget {
          id
          slug
          project {
            id
          }
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

function CreateTargetModal(props: { isOpen: boolean; toggleModalOpen: () => void }) {
  const { organizationSlug, projectSlug } = useSlugs('project');
  const [_, mutate] = useMutation(CreateTarget_CreateTargetMutation);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<CreateTargetFormValues>({
    mode: 'onChange',
    resolver: zodResolver(CreateTargetFormSchema),
    defaultValues: {
      targetSlug: '',
    },
  });

  async function onSubmit(values: CreateTargetFormValues) {
    const { data, error } = await mutate({
      input: {
        project: {
          bySelector: {
            projectSlug,
            organizationSlug,
          },
        },
        slug: values.targetSlug,
      },
    });

    if (data?.createTarget.ok) {
      props.toggleModalOpen();
      void router.navigate({
        to: '/$organizationSlug/$projectSlug/$targetSlug',
        params: {
          organizationSlug,
          projectSlug,
          targetSlug: data.createTarget.ok.createdTarget.slug,
        },
      });
      toast({
        variant: 'default',
        title: 'Target created',
        description: `Your target "${data.createTarget.ok.createdTarget.slug}" has been created`,
      });
    } else if (data?.createTarget.error?.inputErrors.slug) {
      form.setError('targetSlug', {
        message: data?.createTarget.error?.inputErrors.slug,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Failed to create target',
        description: error?.message || data?.createTarget.error?.message,
      });
    }
  }

  return (
    <Dialog
      open={props.isOpen}
      onOpenChange={props.toggleModalOpen}
      title="Create a new target"
      description={
        <>
          A project is built on top of <b>Targets</b>, which are just your environments.
        </>
      }
    >
      <CreateTargetForm form={form} onSubmit={onSubmit} />
    </Dialog>
  );
}
