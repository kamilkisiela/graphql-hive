import { ReactElement, useCallback, useState } from 'react';
import NextLink from 'next/link';
import { useFormik } from 'formik';
import { gql, useMutation, useQuery } from 'urql';
import * as Yup from 'yup';

import { ProjectLayout } from '@/components/layouts';
import { Button, Card, Heading, Input, Link, Select, Spinner, Tag, Title } from '@/components/v2';
import { AlertTriangleIcon } from '@/components/v2/icon';
import { DeleteProjectModal } from '@/components/v2/modals';
import { GetGitHubIntegrationDetailsDocument, OrganizationFieldsFragment, ProjectFieldsFragment } from '@/graphql';
import { canAccessProject, ProjectAccessScope, useProjectAccess } from '@/lib/access/project';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const Settings_UpdateProjectGitRepositoryMutation = gql(/* GraphQL */ `
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

const GitHubIntegration = ({ gitRepository }: { gitRepository: string }): ReactElement => {
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
  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } = useFormik({
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
    return <Spinner />;
  }

  const hasGitHubIntegration = integrationQuery.data?.hasGitHubIntegration === true;

  if (hasGitHubIntegration) {
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
            value={values.gitRepository}
            onChange={handleChange}
            onBlur={handleBlur}
            isInvalid={touched.gitRepository && Boolean(errors.gitRepository)}
          />
          <Button type="submit" variant="primary" size="large" className="px-10" disabled={isSubmitting}>
            Save
          </Button>
        </form>
        {touched.gitRepository && (errors.gitRepository || mutation.error) && (
          <div className="mt-2 text-red-500">
            {errors.gitRepository ?? mutation.error.graphQLErrors[0]?.message ?? mutation.error.message}
          </div>
        )}
        {mutation.data?.updateProjectGitRepository.error && (
          <div className="mt-2 text-red-500">{mutation.data.updateProjectGitRepository.error.message}</div>
        )}
      </>
    );
  }

  return (
    <Tag className="!p-4">
      The organization is not connected to our GitHub Application.
      <NextLink passHref href={`/${router.organizationId}#settings`}>
        <Link variant="primary">Visit settings</Link>
      </NextLink>
      to configure it.
    </Tag>
  );
};

const Settings_UpdateProjectNameMutation = gql(/* GraphQL */ `
  mutation Settings_UpdateProjectName($input: UpdateProjectNameInput!) {
    updateProjectName(input: $input) {
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

const Page = ({
  organization,
  project,
}: {
  organization: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
}) => {
  useProjectAccess({
    scope: ProjectAccessScope.Settings,
    member: organization.me,
    redirect: true,
  });
  const router = useRouteSelector();
  const [isModalOpen, setModalOpen] = useState(false);
  const toggleModalOpen = useCallback(() => {
    setModalOpen(prevOpen => !prevOpen);
  }, []);

  const [mutation, mutate] = useMutation(Settings_UpdateProjectNameMutation);

  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched } = useFormik({
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
      }),
  });

  return (
    <>
      <Card>
        <Heading className="mb-2">Project Name</Heading>
        <p className="mb-3 font-light text-gray-300">Name of your project visible within organization</p>
        <form onSubmit={handleSubmit} className="flex gap-x-2">
          <Input
            placeholder="Project name"
            name="name"
            value={values.name}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={isSubmitting}
            isInvalid={touched.name && Boolean(errors.name)}
            className="w-96"
          />
          <Button type="submit" variant="primary" size="large" className="px-10" disabled={isSubmitting}>
            Save
          </Button>
        </form>
        {touched.name && (errors.name || mutation.error) && (
          <div className="mt-2 text-red-500">
            {errors.name ?? mutation.error.graphQLErrors[0]?.message ?? mutation.error.message}
          </div>
        )}
        {mutation.data?.updateProjectName.error && (
          <div className="mt-2 text-red-500">{mutation.data.updateProjectName.error.message}</div>
        )}
      </Card>

      <Card>
        <Heading className="mb-2">Git Repository</Heading>
        <p className="mb-3 font-light text-gray-300">Connect the project with your Git repository</p>
        <GitHubIntegration gitRepository={project?.gitRepository} />
      </Card>

      {canAccessProject(ProjectAccessScope.Delete, organization.me) && (
        <Card>
          <Heading className="mb-2">Delete Project</Heading>
          <p className="mb-3 font-light text-gray-300">
            Permanently remove your Project and all targets from the Organization
          </p>
          <div className="flex items-center gap-x-2">
            <Button variant="primary" size="large" danger onClick={toggleModalOpen} className="px-5">
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

export default function SettingsPage(): ReactElement {
  return (
    <>
      <Title title="Project settings" />
      <ProjectLayout value="settings" className="flex flex-col gap-y-10">
        {props => <Page {...props} />}
      </ProjectLayout>
    </>
  );
}
