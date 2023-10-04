import { ReactElement } from 'react';
import NextLink from 'next/link';
import { useFormik } from 'formik';
import { ArrowBigDownDashIcon, CheckIcon } from 'lucide-react';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { authenticated } from '@/components/authenticated-container';
import { Page, ProjectLayout } from '@/components/layouts/project';
import { ExternalCompositionSettings } from '@/components/project/settings/external-composition';
import { ModelMigrationSettings } from '@/components/project/settings/model-migration';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { DocsLink, Input, MetaTitle, Select, Tag } from '@/components/v2';
import { HiveLogo } from '@/components/v2/icon';
import { DeleteProjectModal } from '@/components/v2/modals';
import { graphql, useFragment } from '@/gql';
import { ProjectType } from '@/graphql';
import { canAccessProject, ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { getDocsUrl } from '@/lib/docs-url';
import { useNotifications, useRouteSelector, useToggle } from '@/lib/hooks';
import { withSessionProtection } from '@/lib/supertokens/guard';

const ProjectSettingsPage_UpdateProjectGitRepositoryMutation = graphql(`
  mutation ProjectSettingsPage_UpdateProjectGitRepository(
    $input: UpdateProjectGitRepositoryInput!
  ) {
    updateProjectGitRepository(input: $input) {
      ok {
        selector {
          organization
          project
        }
        updatedProject {
          ...ProjectFields
        }
      }
      error {
        message
      }
    }
  }
`);

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

export const GithubIntegration_EnableProjectNameInGitHubCheckMutation = graphql(`
  mutation GithubIntegration_EnableProjectNameInGitHubCheckMutation($input: ProjectSelectorInput!) {
    enableProjectNameInGithubCheck(input: $input) {
      id
      cleanId
      isProjectNameInGitHubCheckEnabled
    }
  }
`);

function GitHubIntegration(props: {
  gitRepository: string | null;
  isProjectNameInGitHubCheckEnabled: boolean;
  organizationName: string;
  projectName: string;
}): ReactElement | null {
  const router = useRouteSelector();
  const docksLink = getDocsUrl('integrations/ci-cd#github-workflow-for-ci');
  const [integrationQuery] = useQuery({
    query: GithubIntegration_GithubIntegrationDetailsQuery,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });
  const gitRepository = props.gitRepository ?? '';

  const notify = useNotifications();

  const [mutation, mutate] = useMutation(ProjectSettingsPage_UpdateProjectGitRepositoryMutation);
  const [ghCheckMutation, ghCheckMutate] = useMutation(
    GithubIntegration_EnableProjectNameInGitHubCheckMutation,
  );
  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } =
    useFormik({
      enableReinitialize: true,
      initialValues: {
        gitRepository,
      },
      validationSchema: Yup.object().shape({
        gitRepository: Yup.string(),
      }),
      onSubmit: values =>
        mutate({
          input: {
            organization: router.organizationId,
            project: router.projectId,
            gitRepository: values.gitRepository === '' ? null : values.gitRepository,
          },
        }).then(result => {
          if (result.data?.updateProjectGitRepository.ok) {
            notify('Updated Git repository', 'success');
          } else {
            notify('Failed to update Git repository', 'error');
          }
        }),
    });

  if (integrationQuery.fetching) {
    return null;
  }

  const githubIntegration = integrationQuery.data?.organization?.organization.gitHubIntegration;

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Git Repository</CardTitle>
          <CardDescription>
            Associate your project with a Git repository to enable commit linking and to allow CI
            integration.
            <br />
            <DocsLink
              className="text-muted-foreground text-sm"
              href="/management/projects#github-repository"
            >
              Learn more about GitHub integration
            </DocsLink>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!!githubIntegration && !props.isProjectNameInGitHubCheckEnabled ? (
            <div className="flex flex-row justify-between items-center rounded-sm p-4 mb-4 gap-x-4 text-sm bg-gray-500/10 text-gray-500">
              <div className="space-y-2">
                <div>
                  <div className="text-gray-300 font-bold">Use project's name in GitHub Check</div>
                  <div>
                    Prevents GitHub Check name collisions when running{' '}
                    {docksLink ? (
                      <NextLink href={docksLink}>
                        <span className="mx-1 text-orange-700 hover:underline hover:underline-offset-4">
                          $ hive schema:check --github
                        </span>
                      </NextLink>
                    ) : (
                      <span className="mx-1 text-orange-700">$ hive schema:check --github</span>
                    )}
                    for more than one project.
                  </div>
                </div>
                <div>
                  <div className="mt-4 mb-2">Here's how it will look like in your CI pipeline:</div>
                  <div className="flex items-center gap-x-2 pl-1">
                    <CheckIcon className="w-4 h-4 text-emerald-500" />
                    <div className="bg-white w-6 h-6 flex items-center justify-center rounded-sm">
                      <HiveLogo className="w-[80%] h-[80%]" />
                    </div>

                    <div className="font-semibold text-[#adbac7]">
                      {props.organizationName} &gt; schema:check &gt; staging
                    </div>
                    <div className="text-gray-500">— No changes</div>
                  </div>
                </div>
                <div>
                  <ArrowBigDownDashIcon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-x-2 pl-1">
                    <CheckIcon className="w-4 h-4 text-emerald-500" />
                    <div className="bg-white w-6 h-6 flex items-center justify-center rounded-sm">
                      <HiveLogo className="w-[80%] h-[80%]" />
                    </div>

                    <div className="font-semibold text-[#adbac7]">
                      {props.organizationName} &gt; schema:check &gt; {props.projectName} &gt;
                      staging
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
                        organization: router.organizationId,
                        project: router.projectId,
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
          ) : null}

          {githubIntegration ? (
            <>
              <Select
                name="gitRepository"
                placeholder="None"
                className="w-96"
                options={githubIntegration.repositories.map(repo => ({
                  name: repo.nameWithOwner,
                  value: repo.nameWithOwner,
                }))}
                value={values.gitRepository ?? undefined}
                onChange={handleChange}
                onBlur={handleBlur}
                isInvalid={!!(touched.gitRepository && errors.gitRepository)}
              />
              {touched.gitRepository && (errors.gitRepository || mutation.error) && (
                <div className="mt-2 text-red-500">
                  {errors.gitRepository ??
                    mutation.error?.graphQLErrors[0]?.message ??
                    mutation.error?.message}
                </div>
              )}
              {mutation.data?.updateProjectGitRepository.error && (
                <div className="mt-2 text-red-500">
                  {mutation.data.updateProjectGitRepository.error.message}
                </div>
              )}
            </>
          ) : (
            <Tag className="!p-4 block">
              <p>The organization is not connected to our GitHub Application.</p>
              <p>
                <Button asChild className="p-0 mr-1" variant="link">
                  <NextLink
                    href={{
                      pathname: '/[organizationId]/view/settings',
                      query: {
                        organizationId: router.organizationId,
                      },
                    }}
                  >
                    Visit organization settings
                  </NextLink>
                </Button>
                to configure it.
              </p>
            </Tag>
          )}
        </CardContent>
        {githubIntegration ? (
          <CardFooter>
            <Button
              type="submit"
              className="px-10"
              disabled={isSubmitting || gitRepository === values.gitRepository}
            >
              Save
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    </form>
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
          ...ProjectFields
          cleanId
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
  }
`);

const ProjectSettingsPage_ProjectFragment = graphql(`
  fragment ProjectSettingsPage_ProjectFragment on Project {
    name
    gitRepository
    type
    isProjectNameInGitHubCheckEnabled
    ...ModelMigrationSettings_ProjectFragment
    ...ExternalCompositionSettings_ProjectFragment
  }
`);

const ProjectSettingsPageQuery = graphql(`
  query ProjectSettingsPageQuery($organizationId: ID!, $projectId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        ...ProjectSettingsPage_OrganizationFragment
        ...ProjectLayout_CurrentOrganizationFragment
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...ProjectLayout_CurrentProjectFragment
      ...ProjectSettingsPage_ProjectFragment
    }
    organizations {
      ...ProjectLayout_OrganizationConnectionFragment
    }
    me {
      id
      ...ProjectLayout_MeFragment
    }
    isGitHubIntegrationFeatureEnabled
  }
`);

function ProjectSettingsContent() {
  const router = useRouteSelector();
  const [isModalOpen, toggleModalOpen] = useToggle();
  const [query] = useQuery({
    query: ProjectSettingsPageQuery,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
    },
    requestPolicy: 'cache-and-network',
  });

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const currentProject = query.data?.project;
  const organizationConnection = query.data?.organizations;

  const organization = useFragment(ProjectSettingsPage_OrganizationFragment, currentOrganization);
  const project = useFragment(ProjectSettingsPage_ProjectFragment, currentProject);
  useProjectAccess({
    scope: ProjectAccessScope.Settings,
    member: organization?.me ?? null,
    redirect: true,
  });

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
            organization: router.organizationId,
            project: router.projectId,
            name: values.name,
          },
        }).then(result => {
          if (result?.data?.updateProjectName?.ok) {
            const newProjectId = result.data.updateProjectName.ok.updatedProject.cleanId;
            void router.replace(`/${router.organizationId}/${newProjectId}/view/settings`);
          }
        }),
    });

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  return (
    <ProjectLayout
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      organizations={organizationConnection ?? null}
      me={me ?? null}
      page={Page.Settings}
      className="flex flex-col gap-y-10"
    >
      <div>
        <div className="py-6">
          <Title>Settings</Title>
          <Subtitle>Manage your project settings</Subtitle>
        </div>
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

              {query.data?.isGitHubIntegrationFeatureEnabled ? (
                <GitHubIntegration
                  gitRepository={project.gitRepository ?? null}
                  organizationName={organization.name}
                  projectName={project.name}
                  isProjectNameInGitHubCheckEnabled={project.isProjectNameInGitHubCheckEnabled}
                />
              ) : null}

              {project.type === ProjectType.Federation ? (
                <ExternalCompositionSettings project={project} organization={organization} />
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
              <DeleteProjectModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
            </>
          ) : null}
        </div>
      </div>
    </ProjectLayout>
  );
}

function SettingsPage() {
  return (
    <>
      <MetaTitle title="Project settings" />
      <ProjectSettingsContent />
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(SettingsPage);
