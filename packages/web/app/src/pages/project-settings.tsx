import { ReactElement, useCallback } from 'react';
import { ArrowBigDownDashIcon, CheckIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'urql';
import { z } from 'zod';
import { Page, ProjectLayout } from '@/components/layouts/project';
import { ExternalCompositionSettings } from '@/components/project/settings/external-composition';
import { ModelMigrationSettings } from '@/components/project/settings/model-migration';
import { NativeCompositionSettings } from '@/components/project/settings/native-composition';
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
import { HiveLogo } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { useToast } from '@/components/ui/use-toast';
import { env } from '@/env/frontend';
import { graphql, useFragment } from '@/gql';
import { ProjectType } from '@/gql/graphql';
import { canAccessProject, ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { getDocsUrl } from '@/lib/docs-url';
import { useNotifications, useToggle } from '@/lib/hooks';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from '@tanstack/react-router';

const GithubIntegration_GithubIntegrationDetailsQuery = graphql(`
  query getGitHubIntegrationDetails($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        id
        gitHubIntegration {
          repositories {
            nameWithOwner
          }
        }
      }
    }
  }
`);

const GithubIntegration_EnableProjectNameInGitHubCheckMutation = graphql(`
  mutation GithubIntegration_EnableProjectNameInGitHubCheckMutation($input: ProjectSelectorInput!) {
    enableProjectNameInGithubCheck(input: $input) {
      id
      slug
      isProjectNameInGitHubCheckEnabled
    }
  }
`);

function GitHubIntegration(props: {
  organizationSlug: string;
  projectSlug: string;
}): ReactElement | null {
  const docksLink = getDocsUrl('integrations/ci-cd#github-workflow-for-ci');
  const notify = useNotifications();
  const [integrationQuery] = useQuery({
    query: GithubIntegration_GithubIntegrationDetailsQuery,
    variables: {
      selector: {
        organizationSlug: props.organizationSlug,
      },
    },
  });

  const [ghCheckMutation, ghCheckMutate] = useMutation(
    GithubIntegration_EnableProjectNameInGitHubCheckMutation,
  );

  if (integrationQuery.fetching) {
    return null;
  }

  const githubIntegration = integrationQuery.data?.organization?.organization.gitHubIntegration;

  if (!githubIntegration) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Use project's name in GitHub Check</CardTitle>
        <CardDescription>
          Prevents GitHub Check name collisions when running{' '}
          <a href={docksLink}>
            <span className="mx-1 text-orange-700 hover:underline hover:underline-offset-4">
              $ hive schema:check --github
            </span>
          </a>
          for more than one project.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-muted-foreground mb-4 flex flex-row items-center justify-between gap-x-4 rounded-sm text-sm">
          <div className="space-y-2">
            <div>
              <div className="mb-4">Here's how it will look like in your CI pipeline.</div>
              <div className="flex items-center gap-x-2 pl-1">
                <CheckIcon className="size-4 text-emerald-500" />
                <div className="flex size-6 items-center justify-center rounded-sm bg-white">
                  <HiveLogo className="size-4/5" />
                </div>

                <div className="font-semibold text-[#adbac7]">
                  {props.organizationSlug} &gt; schema:check &gt; staging
                </div>
                <div className="text-gray-500">— No changes</div>
              </div>
            </div>
            <div>
              <ArrowBigDownDashIcon className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-x-2 pl-1">
                <CheckIcon className="size-4 text-emerald-500" />
                <div className="flex size-6 items-center justify-center rounded-sm bg-white">
                  <HiveLogo className="size-4/5" />
                </div>

                <div className="font-semibold text-[#adbac7]">
                  {props.organizationSlug} &gt; schema:check &gt; {props.projectSlug} &gt; staging
                </div>
                <div className="text-gray-500">— No changes</div>
              </div>
            </div>
          </div>
          <div className="pr-6">
            <Button
              disabled={ghCheckMutation.fetching}
              onClick={() => {
                void ghCheckMutate({
                  input: {
                    organizationSlug: props.organizationSlug,
                    projectSlug: props.projectSlug,
                  },
                }).then(
                  result => {
                    if (result.error) {
                      notify('Failed to enable', 'error');
                    } else {
                      notify('Migration completed', 'success');
                    }
                  },
                  _ => {
                    notify('Failed to enable', 'error');
                  },
                );
              }}
            >
              I want to migrate
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ProjectSettingsPage_UpdateProjectSlugMutation = graphql(`
  mutation ProjectSettingsPage_UpdateProjectSlugMutation($input: UpdateProjectSlugInput!) {
    updateProjectSlug(input: $input) {
      ok {
        selector {
          organizationSlug
          projectSlug
        }
        project {
          id
          slug
        }
      }
      error {
        message
      }
    }
  }
`);

const SlugFormSchema = z.object({
  slug: z
    .string({
      required_error: 'Project slug is required',
    })
    .min(1, 'Project slug is required')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers and dashes'),
});

type SlugFormValues = z.infer<typeof SlugFormSchema>;

function ProjectSettingsPage_SlugForm(props: { organizationSlug: string; projectSlug: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const [_slugMutation, slugMutate] = useMutation(ProjectSettingsPage_UpdateProjectSlugMutation);

  const slugForm = useForm({
    mode: 'all',
    resolver: zodResolver(SlugFormSchema),
    defaultValues: {
      slug: props.projectSlug,
    },
  });

  const onSlugFormSubmit = useCallback(
    async (data: SlugFormValues) => {
      try {
        const result = await slugMutate({
          input: {
            organizationSlug: props.organizationSlug,
            projectSlug: props.projectSlug,
            slug: data.slug,
          },
        });

        const error = result.error || result.data?.updateProjectSlug.error;

        if (result.data?.updateProjectSlug?.ok) {
          toast({
            variant: 'default',
            title: 'Success',
            description: 'Project slug updated',
          });
          void router.navigate({
            to: '/$organizationSlug/$projectSlug/view/settings',
            params: {
              organizationSlug: props.organizationSlug,
              projectSlug: result.data.updateProjectSlug.ok.project.slug,
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
          description: 'Failed to update project slug',
        });
      }
    },
    [slugMutate],
  );

  return (
    <Form {...slugForm}>
      <form onSubmit={slugForm.handleSubmit(onSlugFormSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>Project Slug</CardTitle>
            <CardDescription>
              This is your project's URL namespace on Hive. Changing it{' '}
              <span className="font-bold">will</span> invalidate any existing links to your project.
              <br />
              <DocsLink
                className="text-muted-foreground text-sm"
                href="/management/projects#change-slug-of-a-project"
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
                        {env.appBaseUrl.replace(/https?:\/\//i, '')}/{props.organizationSlug}/
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
            <Button disabled={slugForm.formState.isSubmitting} className="px-10" type="submit">
              Save
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}

const ProjectSettingsPage_OrganizationFragment = graphql(`
  fragment ProjectSettingsPage_OrganizationFragment on Organization {
    id
    slug
    me {
      id
      ...CanAccessProject_MemberFragment
    }
    ...ExternalCompositionSettings_OrganizationFragment
    ...NativeCompositionSettings_OrganizationFragment
  }
`);

const ProjectSettingsPage_ProjectFragment = graphql(`
  fragment ProjectSettingsPage_ProjectFragment on Project {
    slug
    type
    isProjectNameInGitHubCheckEnabled
    ...ModelMigrationSettings_ProjectFragment
    ...ExternalCompositionSettings_ProjectFragment
    ...NativeCompositionSettings_ProjectFragment
  }
`);

const ProjectSettingsPageQuery = graphql(`
  query ProjectSettingsPageQuery($organizationSlug: String!, $projectSlug: String!) {
    organization(selector: { organizationSlug: $organizationSlug }) {
      organization {
        ...ProjectSettingsPage_OrganizationFragment
      }
    }
    project(selector: { organizationSlug: $organizationSlug, projectSlug: $projectSlug }) {
      ...ProjectSettingsPage_ProjectFragment
    }
    isGitHubIntegrationFeatureEnabled
  }
`);

function ProjectSettingsContent(props: { organizationSlug: string; projectSlug: string }) {
  const [isModalOpen, toggleModalOpen] = useToggle();
  const [query] = useQuery({
    query: ProjectSettingsPageQuery,
    variables: {
      organizationSlug: props.organizationSlug,
      projectSlug: props.projectSlug,
    },
    requestPolicy: 'cache-and-network',
  });

  const currentOrganization = query.data?.organization?.organization;
  const currentProject = query.data?.project;

  const organization = useFragment(ProjectSettingsPage_OrganizationFragment, currentOrganization);
  const project = useFragment(ProjectSettingsPage_ProjectFragment, currentProject);
  const hasAccess = useProjectAccess({
    scope: ProjectAccessScope.Settings,
    member: organization?.me ?? null,
    redirect: true,
    organizationSlug: props.organizationSlug,
    projectSlug: props.projectSlug,
  });

  if (query.error) {
    return <QueryError organizationSlug={props.organizationSlug} error={query.error} />;
  }

  return (
    <ProjectLayout
      organizationSlug={props.organizationSlug}
      projectSlug={props.projectSlug}
      page={Page.Settings}
      className="flex flex-col gap-y-10"
    >
      <div>
        <div className="py-6">
          <Title>Settings</Title>
          <Subtitle>Manage your project settings</Subtitle>
        </div>
        {hasAccess ? (
          <div className="flex flex-col gap-y-4">
            {project && organization ? (
              <>
                <ModelMigrationSettings project={project} organizationSlug={organization.slug} />
                <ProjectSettingsPage_SlugForm
                  organizationSlug={props.organizationSlug}
                  projectSlug={props.projectSlug}
                />
                {query.data?.isGitHubIntegrationFeatureEnabled &&
                !project.isProjectNameInGitHubCheckEnabled ? (
                  <GitHubIntegration
                    organizationSlug={organization.slug}
                    projectSlug={project.slug}
                  />
                ) : null}

                {project.type === ProjectType.Federation ? (
                  <ExternalCompositionSettings project={project} organization={organization} />
                ) : null}

                {project.type === ProjectType.Federation ? (
                  <NativeCompositionSettings project={project} organization={organization} />
                ) : null}

                {canAccessProject(ProjectAccessScope.Delete, organization.me) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Delete Project</CardTitle>
                      <CardDescription>
                        Deleting an project will delete all the targets, schemas and data associated
                        with it.
                        <br />
                        <DocsLink
                          className="text-muted-foreground text-sm"
                          href="/management/projects#delete-a-project"
                        >
                          <strong>This action is not reversible!</strong> You can find more
                          information about this process in the documentation
                        </DocsLink>
                      </CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Button variant="destructive" onClick={toggleModalOpen}>
                        Delete Project
                      </Button>
                    </CardFooter>
                  </Card>
                )}
                <DeleteProjectModal
                  projectSlug={props.projectSlug}
                  organizationSlug={props.organizationSlug}
                  isOpen={isModalOpen}
                  toggleModalOpen={toggleModalOpen}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </ProjectLayout>
  );
}

export function ProjectSettingsPage(props: { organizationSlug: string; projectSlug: string }) {
  return (
    <>
      <Meta title="Project settings" />
      <ProjectSettingsContent
        organizationSlug={props.organizationSlug}
        projectSlug={props.projectSlug}
      />
    </>
  );
}

export const DeleteProjectMutation = graphql(`
  mutation deleteProject($selector: ProjectSelectorInput!) {
    deleteProject(selector: $selector) {
      selector {
        organizationSlug
        projectSlug
      }
      deletedProject {
        __typename
        id
      }
    }
  }
`);

export function DeleteProjectModal(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  organizationSlug: string;
  projectSlug: string;
}) {
  const { organizationSlug, projectSlug } = props;
  const [, mutate] = useMutation(DeleteProjectMutation);
  const { toast } = useToast();
  const router = useRouter();

  const handleDelete = async () => {
    const { error } = await mutate({
      selector: {
        organizationSlug,
        projectSlug,
      },
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete project',
        description: error.message,
      });
    } else {
      toast({
        title: 'Project deleted',
        description: 'The project has been successfully deleted.',
      });
      props.toggleModalOpen();
      void router.navigate({
        to: '/$organizationSlug',
        params: {
          organizationSlug,
        },
      });
    }
  };

  return (
    <DeleteProjectModalContent
      isOpen={props.isOpen}
      toggleModalOpen={props.toggleModalOpen}
      handleDelete={handleDelete}
    />
  );
}

export function DeleteProjectModalContent(props: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  handleDelete: () => void;
}) {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.toggleModalOpen}>
      <DialogContent className="w-4/5 max-w-[520px] md:w-3/5">
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>
            Every target and its published schema, reported data, and settings associated with this
            project will be permanently deleted.
          </DialogDescription>
          <DialogDescription className="font-bold">This action is irreversible!</DialogDescription>
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
