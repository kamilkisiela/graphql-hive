import { ReactElement } from 'react';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { authenticated } from '@/components/authenticated-container';
import { ProjectLayout } from '@/components/layouts/project';
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
import { DocsLink, Input, Link, MetaTitle, Select, Tag } from '@/components/v2';
import { DeleteProjectModal } from '@/components/v2/modals';
import { graphql, useFragment } from '@/gql';
import { GetGitHubIntegrationDetailsDocument, ProjectType } from '@/graphql';
import { canAccessProject, ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { useNotFoundRedirectOnError } from '@/lib/hooks/use-not-found-redirect-on-error';
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

function GitHubIntegration({
  gitRepository,
}: {
  gitRepository: string | null;
}): ReactElement | null {
  const router = useRouteSelector();
  const [integrationQuery] = useQuery({
    query: GetGitHubIntegrationDetailsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });

  const [mutation, mutate] = useMutation(ProjectSettingsPage_UpdateProjectGitRepositoryMutation);
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
            gitRepository: values.gitRepository,
          },
        }),
    });

  if (integrationQuery.fetching) {
    return null;
  }

  const githubIntegration = integrationQuery.data?.gitHubIntegration;

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
            <Tag className="!p-4">
              The organization is not connected to our GitHub Application.
              <Link variant="primary" href={`/${router.organizationId}#settings`}>
                Visit settings
              </Link>
              to configure it.
            </Tag>
          )}
        </CardContent>
        {githubIntegration ? (
          <CardFooter>
            <Button type="submit" className="px-10" disabled={isSubmitting}>
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
    cleanId
    me {
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
      ...ProjectLayout_MeFragment
    }
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

  useNotFoundRedirectOnError(!!query.error);

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
    return null;
  }

  return (
    <ProjectLayout
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      organizations={organizationConnection ?? null}
      me={me ?? null}
      value="settings"
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

              <GitHubIntegration gitRepository={project.gitRepository ?? null} />

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
