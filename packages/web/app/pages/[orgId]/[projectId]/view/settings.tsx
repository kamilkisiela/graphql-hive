import { ReactElement } from 'react';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { authenticated } from '@/components/authenticated-container';
import { ProjectLayout } from '@/components/layouts';
import { ExternalCompositionSettings } from '@/components/project/settings/external-composition';
import { ModelMigrationSettings } from '@/components/project/settings/model-migration';
import { Button, Card, Heading, Input, Link, Select, Tag, Title } from '@/components/v2';
import { AlertTriangleIcon } from '@/components/v2/icon';
import { DeleteProjectModal } from '@/components/v2/modals';
import { FragmentType, graphql, useFragment } from '@/gql';
import { GetGitHubIntegrationDetailsDocument, ProjectType } from '@/graphql';
import { canAccessProject, ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { useRouteSelector, useToggle } from '@/lib/hooks';
import { withSessionProtection } from '@/lib/supertokens/guard';

const Settings_UpdateProjectGitRepositoryMutation = graphql(`
  mutation Settings_UpdateProjectGitRepository($input: UpdateProjectGitRepositoryInput!) {
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

  const [mutation, mutate] = useMutation(Settings_UpdateProjectGitRepositoryMutation);
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

  if (integrationQuery.data?.gitHubIntegration) {
    return (
      <>
        <form className="flex gap-x-2" onSubmit={handleSubmit}>
          <Select
            name="gitRepository"
            placeholder="None"
            className="w-96"
            options={integrationQuery.data.gitHubIntegration.repositories.map(repo => ({
              name: repo.nameWithOwner,
              value: repo.nameWithOwner,
            }))}
            value={values.gitRepository ?? undefined}
            onChange={handleChange}
            onBlur={handleBlur}
            isInvalid={!!(touched.gitRepository && errors.gitRepository)}
          />
          <Button
            type="submit"
            variant="primary"
            size="large"
            className="px-10"
            disabled={isSubmitting}
          >
            Save
          </Button>
        </form>
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
    );
  }

  return (
    <Tag className="!p-4">
      The organization is not connected to our GitHub Application.
      <Link variant="primary" href={`/${router.organizationId}#settings`}>
        Visit settings
      </Link>
      to configure it.
    </Tag>
  );
}

const Settings_UpdateProjectNameMutation = graphql(`
  mutation Settings_UpdateProjectName($input: UpdateProjectNameInput!) {
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

const SettingsPage_OrganizationFragment = graphql(`
  fragment SettingsPage_OrganizationFragment on Organization {
    cleanId
    me {
      ...CanAccessProject_MemberFragment
    }
    ...ExternalCompositionSettings_OrganizationFragment
  }
`);

const SettingsPage_ProjectFragment = graphql(`
  fragment SettingsPage_ProjectFragment on Project {
    name
    gitRepository
    type
    ...ModelMigrationSettings_ProjectFragment
    ...ExternalCompositionSettings_ProjectFragment
  }
`);

const Page = (props: {
  organization: FragmentType<typeof SettingsPage_OrganizationFragment>;
  project: FragmentType<typeof SettingsPage_ProjectFragment>;
}) => {
  const organization = useFragment(SettingsPage_OrganizationFragment, props.organization);
  const project = useFragment(SettingsPage_ProjectFragment, props.project);
  useProjectAccess({
    scope: ProjectAccessScope.Settings,
    member: organization.me,
    redirect: true,
  });
  const router = useRouteSelector();
  const [isModalOpen, toggleModalOpen] = useToggle();

  const [mutation, mutate] = useMutation(Settings_UpdateProjectNameMutation);

  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } =
    useFormik({
      enableReinitialize: true,
      initialValues: {
        name: project?.name,
      },
      validationSchema: Yup.object().shape({
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

  return (
    <>
      <ModelMigrationSettings project={project} organizationId={organization.cleanId} />
      <Card>
        <Heading className="mb-2">Project Name</Heading>
        <p className="mb-3 font-light text-gray-300">
          Name of your project visible within organization
        </p>
        <form onSubmit={handleSubmit} className="flex gap-x-2">
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
          <Button
            type="submit"
            variant="primary"
            size="large"
            className="px-10"
            disabled={isSubmitting}
          >
            Save
          </Button>
        </form>
        {touched.name && (errors.name || mutation.error) && (
          <div className="mt-2 text-red-500">
            {errors.name ?? mutation.error?.graphQLErrors[0]?.message ?? mutation.error?.message}
          </div>
        )}
        {mutation.data?.updateProjectName.error && (
          <div className="mt-2 text-red-500">{mutation.data.updateProjectName.error.message}</div>
        )}
      </Card>

      <Card>
        <Heading className="mb-2">Git Repository</Heading>
        <p className="mb-3 font-light text-gray-300">
          Connect the project with your Git repository
        </p>
        <GitHubIntegration gitRepository={project.gitRepository ?? null} />
      </Card>

      {project.type === ProjectType.Federation ? (
        <ExternalCompositionSettings project={project} organization={organization} />
      ) : null}

      {canAccessProject(ProjectAccessScope.Delete, organization.me) && (
        <Card>
          <Heading className="mb-2">Delete Project</Heading>
          <p className="mb-3 font-light text-gray-300">
            Permanently remove your Project and all targets from the Organization
          </p>
          <div className="flex items-center gap-x-2">
            <Button
              variant="primary"
              size="large"
              danger
              onClick={toggleModalOpen}
              className="px-5"
            >
              Delete Project
            </Button>
            <Tag color="yellow" className="py-2.5 px-4">
              <AlertTriangleIcon className="h-5 w-5" />
              This action is not reversible!
            </Tag>
          </div>
        </Card>
      )}
      <DeleteProjectModal isOpen={isModalOpen} toggleModalOpen={toggleModalOpen} />
    </>
  );
};

const SettingsPageQuery = graphql(`
  query SettingsPageQuery($organizationId: ID!, $projectId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        ...SettingsPage_OrganizationFragment
        ...ProjectLayout_OrganizationFragment
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...ProjectLayout_ProjectFragment
      ...SettingsPage_ProjectFragment
    }
  }
`);

function SettingsPage(): ReactElement {
  return (
    <>
      <Title title="Project settings" />
      <ProjectLayout value="settings" className="flex flex-col gap-y-10" query={SettingsPageQuery}>
        {props => <Page {...props} />}
      </ProjectLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(SettingsPage);
