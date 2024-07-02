import { ReactElement } from 'react';
import { useFormik } from 'formik';
import { ArrowBigDownDashIcon, CheckIcon } from 'lucide-react';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
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
import { DocsLink } from '@/components/ui/docs-note';
import { Meta } from '@/components/ui/meta';
import { DeleteProjectModal } from '@/components/ui/modal/delete-project';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { useToast } from '@/components/ui/use-toast';
import { HiveLogo } from '@/components/v2/icon';
import { Input } from '@/components/v2/input';
import { graphql, useFragment } from '@/gql';
import { ProjectType } from '@/gql/graphql';
import { canAccessProject, ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { getDocsUrl } from '@/lib/docs-url';
import { useNotifications, useToggle } from '@/lib/hooks';
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
      cleanId
      isProjectNameInGitHubCheckEnabled
    }
  }
`);

function GitHubIntegration(props: {
  organizationId: string;
  organizationName: string;
  projectId: string;
  projectName: string;
}): ReactElement | null {
  const docksLink = getDocsUrl('integrations/ci-cd#github-workflow-for-ci');
  const notify = useNotifications();
  const [integrationQuery] = useQuery({
    query: GithubIntegration_GithubIntegrationDetailsQuery,
    variables: {
      selector: {
        organization: props.organizationId,
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
                  {props.organizationName} &gt; schema:check &gt; staging
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
                  {props.organizationName} &gt; schema:check &gt; {props.projectName} &gt; staging
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
                    organization: props.organizationId,
                    project: props.projectId,
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

const ProjectSettingsPage_UpdateProjectNameMutation = graphql(`
  mutation ProjectSettingsPage_UpdateProjectName($input: UpdateProjectNameInput!) {
    updateProjectName(input: $input) {
      ok {
        selector {
          organization
          project
        }
        updatedProject {
          id
          cleanId
          name
        }
      }
      error {
        message
      }
    }
  }
`);

const ProjectSettingsPage_OrganizationFragment = graphql(`
  fragment ProjectSettingsPage_OrganizationFragment on Organization {
    id
    cleanId
    name
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
    name
    type
    isProjectNameInGitHubCheckEnabled
    ...ModelMigrationSettings_ProjectFragment
    ...ExternalCompositionSettings_ProjectFragment
    ...NativeCompositionSettings_ProjectFragment
  }
`);

const ProjectSettingsPageQuery = graphql(`
  query ProjectSettingsPageQuery($organizationId: ID!, $projectId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        ...ProjectSettingsPage_OrganizationFragment
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...ProjectSettingsPage_ProjectFragment
    }
    isGitHubIntegrationFeatureEnabled
  }
`);

function ProjectSettingsContent(props: { organizationId: string; projectId: string }) {
  const router = useRouter();
  const [isModalOpen, toggleModalOpen] = useToggle();
  const [query] = useQuery({
    query: ProjectSettingsPageQuery,
    variables: {
      organizationId: props.organizationId,
      projectId: props.projectId,
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
    organizationId: props.organizationId,
    projectId: props.projectId,
  });
  const { toast } = useToast();

  const [mutation, mutate] = useMutation(ProjectSettingsPage_UpdateProjectNameMutation);

  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } =
    useFormik({
      enableReinitialize: true,
      initialValues: {
        name: project?.name ?? '',
      },
      validationSchema: Yup.object({
        name: Yup.string().required('Project name is required'),
      }),
      onSubmit: values =>
        mutate({
          input: {
            organization: props.organizationId,
            project: props.projectId,
            name: values.name,
          },
        }).then(result => {
          if (result?.data?.updateProjectName?.ok) {
            toast({
              variant: 'default',
              title: 'Success',
              description: 'Project name updated successfully',
            });

            const newProjectId = result.data.updateProjectName.ok.updatedProject.cleanId;
            void router.navigate({
              to: '/$organizationId/$projectId/view/settings',
              params: {
                organizationId: props.organizationId,
                projectId: newProjectId,
              },
            });
          } else if (result.error || result.data?.updateProjectName.error) {
            toast({
              variant: 'destructive',
              title: 'Error',
              description: result.error?.message || result.data?.updateProjectName.error?.message,
            });
          }
        }),
    });

  if (query.error) {
    return <QueryError organizationId={props.organizationId} error={query.error} />;
  }

  return (
    <ProjectLayout
      organizationId={props.organizationId}
      projectId={props.projectId}
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
                <ModelMigrationSettings project={project} organizationId={organization.cleanId} />
                <form onSubmit={handleSubmit}>
                  <Card>
                    <CardHeader>
                      <CardTitle>Project Name</CardTitle>
                      <CardDescription>
                        Changing the name of your project will also change the slug of your project
                        URL, and will invalidate any existing links to your project.
                        <br />
                        <DocsLink
                          className="text-muted-foreground text-sm"
                          href="/management/projects#rename-a-project"
                        >
                          You can read more about it in the documentation
                        </DocsLink>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Input
                        placeholder="Project name"
                        name="name"
                        value={values.name}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        disabled={isSubmitting}
                        isInvalid={touched.name && !!errors.name}
                        className="w-96"
                      />
                      {touched.name && (errors.name || mutation.error) && (
                        <div className="mt-2 text-red-500">
                          {errors.name ??
                            mutation.error?.graphQLErrors[0]?.message ??
                            mutation.error?.message}
                        </div>
                      )}
                      {mutation.data?.updateProjectName.error && (
                        <div className="mt-2 text-red-500">
                          {mutation.data.updateProjectName.error.message}
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button type="submit" disabled={isSubmitting}>
                        Save
                      </Button>
                    </CardFooter>
                  </Card>
                </form>

                {query.data?.isGitHubIntegrationFeatureEnabled &&
                !project.isProjectNameInGitHubCheckEnabled ? (
                  <GitHubIntegration
                    organizationId={props.organizationId}
                    organizationName={organization.name}
                    projectId={props.projectId}
                    projectName={project.name}
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
                  projectId={props.projectId}
                  organizationId={props.organizationId}
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

export function ProjectSettingsPage(props: { organizationId: string; projectId: string }) {
  return (
    <>
      <Meta title="Project settings" />
      <ProjectSettingsContent organizationId={props.organizationId} projectId={props.projectId} />
    </>
  );
}
