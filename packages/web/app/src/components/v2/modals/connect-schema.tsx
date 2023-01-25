import { ReactElement, useEffect, useState } from 'react';
import { Spinner } from '@chakra-ui/react';
import { useMutation, useQuery } from 'urql';
import { Button, CopyValue, Heading, Link, Modal, Tag } from '@/components/v2';
import { CreateCdnTokenDocument, ProjectDocument, ProjectType } from '@/graphql';
import { getDocsUrl } from '@/lib/docs-url';
import { useRouteSelector } from '@/lib/hooks';

const taxonomy = {
  [ProjectType.Federation]: 'supergraph schema',
  [ProjectType.Stitching]: 'services',
} as Record<ProjectType, string | undefined>;

export const ConnectSchemaModal = ({
  isOpen,
  toggleModalOpen,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
}): ReactElement => {
  const [generating, setGenerating] = useState(true);
  const router = useRouteSelector();
  const [projectQuery] = useQuery({
    query: ProjectDocument,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
    },
    requestPolicy: 'cache-and-network',
  });
  const [mutation, mutate] = useMutation(CreateCdnTokenDocument);

  useEffect(() => {
    if (!isOpen) {
      setGenerating(true);
      return;
    }

    void mutate({
      selector: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
      },
    }).then(() => {
      setTimeout(() => {
        setGenerating(false);
      }, 2000);
    });
  }, [isOpen, mutate, router.organizationId, router.projectId, router.targetId]);

  const project = projectQuery.data?.project;

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen} className="flex w-[650px] flex-col gap-5">
      <Heading className="text-center">Connect to Hive</Heading>

      {project && generating && (
        <div className="mt-5 flex flex-col items-center gap-2 px-20">
          <Spinner />
          <Heading>Generating access...</Heading>
          <p className="text-center">
            Hive is now generating an authentication token and an URL you can use to fetch your{' '}
            {taxonomy[project.type] ?? 'schema'}.
          </p>
        </div>
      )}

      {project && !generating && mutation.data && (
        <>
          <p className="text-sm text-gray-500">
            With high-availability and multi-zone CDN service based on Cloudflare, Hive allows you
            to access the
            {taxonomy[project.type] ?? 'schema'} of your API, through a secured external service,
            that's always up regardless of Hive.
          </p>
          <span className="text-sm text-gray-500">You can use the following endpoint:</span>
          <CopyValue value={mutation.data.createCdnToken.url} />
          <span className="text-sm text-gray-500">
            To authenticate, use the following HTTP headers:
          </span>
          <Tag>X-Hive-CDN-Key: {mutation.data.createCdnToken.token}</Tag>
          <p className="text-sm text-gray-500">
            Read the{' '}
            <Link
              variant="primary"
              target="_blank"
              rel="noreferrer"
              href={getDocsUrl(`/features/registry-usage#apollo-federation`) ?? ''}
            >
              Using the Registry with a Apollo Gateway
            </Link>{' '}
            chapter in our documentation.
          </p>
        </>
      )}
      <Button
        type="button"
        variant="secondary"
        size="large"
        onClick={toggleModalOpen}
        className="self-end"
      >
        Close
      </Button>
    </Modal>
  );
};
