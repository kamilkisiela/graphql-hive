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
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { DocsLink, Input, MetaTitle } from '@/components/v2';
import { HiveLogo } from '@/components/v2/icon';
import { DeleteProjectModal } from '@/components/v2/modals';
import { graphql, useFragment } from '@/gql';
import { ProjectType } from '@/graphql';
import { canAccessProject, ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { getDocsUrl } from '@/lib/docs-url';
import { useNotifications, useRouteSelector, useToggle } from '@/lib/hooks';
import { withSessionProtection } from '@/lib/supertokens/guard';

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
  organizationName: string;
  projectName: string;
}): ReactElement | null {
  const router = useRouteSelector();
  const docksLink = getDocsUrl('integrations/ci-cd#github-workflow-for-ci');
  const notify = useNotifications();
  const [integrationQuery] = useQuery({
    query: GithubIntegration_GithubIntegrationDetailsQuery,
    variables: {
      selector: {
        organization: router.organizationId,
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
          <NextLink href={docksLink}>
            <span className="mx-1 text-orange-700 hover:underline hover:underline-offset-4">
              $ hive schema:check --github
            </span>
          </NextLink>
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
                  <HiveLogo className="size-[80%]" />
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
                  <HiveLogo className="size-[80%]" />
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
  const hasAccess = useProjectAccess({
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
                    organizationName={organization.name}
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
                <DeleteProjectModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
              </>
            ) : null}
          </div>
        ) : null}
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
