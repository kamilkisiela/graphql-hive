import { ReactElement } from 'react';
import { gql, useQuery } from 'urql';
import { Button, CopyValue, Heading, Link, Modal, Tag } from '@/components/v2';
import { getDocsUrl } from '@/lib/docs-url';
import { useRouteSelector } from '@/lib/hooks';

const ConnectSchemaModalQuery = gql(/* GraphQL */ `
  query ConnectSchemaModal($targetSelector: TargetSelectorInput!) {
    target(selector: $targetSelector) {
      id
      cdnUrl
    }
  }
`);

export const ConnectSchemaModal = ({
  isOpen,
  toggleModalOpen,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
}): ReactElement => {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: ConnectSchemaModalQuery,
    variables: {
      targetSelector: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
      },
    },
    requestPolicy: 'cache-and-network',
  });

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen} className="flex w-[650px] flex-col gap-5">
      <Heading className="text-center">Connect to Hive</Heading>

      {query.data?.target && (
        <>
          <p className="text-sm text-gray-500">
            With high-availability and multi-zone CDN service based on Cloudflare, Hive allows you
            to access the schema of your API, through a secured external service, that's always up
            regardless of Hive.
          </p>
          <span className="text-sm text-gray-500">You can use the following endpoint:</span>
          <CopyValue value={query.data.target.cdnUrl} />
          <span className="text-sm text-gray-500">
            To authenticate, use the access HTTP headers. <br />
          </span>
          <p className="text-sm text-gray-500">
            <Tag>
              X-Hive-CDN-Key: {'<'}Your Access Token{'>'}
            </Tag>
          </p>
          <p className="text-sm text-gray-500">
            You can manage and generate CDN access tokens in the{' '}
            <Link
              variant="primary"
              href={
                '/' +
                [
                  router.organizationId,
                  router.projectId,
                  router.targetId,
                  'settings#cdn-access-tokens',
                ].join('/')
              }
            >
              target settings
            </Link>
          </p>
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
