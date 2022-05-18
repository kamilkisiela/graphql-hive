import React from 'react';
import 'twin.macro';
import { useQuery, useMutation } from 'urql';
import { Select, Button, Link } from '@chakra-ui/react';
import NextLink from 'next/link';
import { Card } from '@/components/common';
import {
  ProjectFieldsFragment,
  GetGitHubIntegrationDetailsDocument,
  UpdateProjectGitRepositoryDocument,
} from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { Spinner } from '@/components/common/Spinner';

export const GitRepositorySettings: React.FC<{
  project: ProjectFieldsFragment;
}> = ({ project }) => {
  const router = useRouteSelector();
  const [selectedRepository, setSelectedRepository] = React.useState<string>(
    project.gitRepository
  );
  const [disabled, setDisabled] = React.useState(false);
  const [, mutate] = useMutation(UpdateProjectGitRepositoryDocument);

  const submit = React.useCallback(() => {
    setDisabled(true);
    mutate({
      input: {
        organization: router.organizationId,
        project: router.projectId,
        gitRepository: selectedRepository,
      },
    }).finally(() => {
      setDisabled(false);
    });
  }, [selectedRepository, setDisabled, mutate, router]);

  const [integrationQuery] = useQuery({
    query: GetGitHubIntegrationDetailsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });

  const hasGitHubIntegration =
    integrationQuery.data?.hasGitHubIntegration === true;

  return (
    <Card.Root>
      <Card.Title>Git Repository</Card.Title>
      <Card.Content>
        <p>Connect the project with your Git repository.</p>
        {integrationQuery.fetching ? (
          <Spinner />
        ) : hasGitHubIntegration ? (
          <form tw="flex flex-row space-x-3 pt-3" onSubmit={submit}>
            <Select
              placeholder="None"
              disabled={disabled}
              value={selectedRepository ?? undefined}
              onChange={(e) => setSelectedRepository(e.target.value)}
            >
              {integrationQuery.data?.gitHubIntegration.repositories.map(
                (repo) => (
                  <option key={repo.nameWithOwner} value={repo.nameWithOwner}>
                    {repo.nameWithOwner}
                  </option>
                )
              )}
            </Select>
            <Button
              colorScheme="primary"
              type="button"
              disabled={disabled}
              isLoading={disabled}
              onClick={submit}
            >
              Save
            </Button>
          </form>
        ) : (
          <div tw="flex flex-row space-x-3 pt-3">
            <span tw="italic">
              The organization is not connected to our GitHub Application.{' '}
              <NextLink passHref href={`/${router.organizationId}/settings`}>
                <Link color="teal.500" size="sm">
                  Visit settings
                </Link>
              </NextLink>{' '}
              to configure it
            </span>
          </div>
        )}
      </Card.Content>
    </Card.Root>
  );
};
