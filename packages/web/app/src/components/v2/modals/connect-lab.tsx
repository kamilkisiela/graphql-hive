import { ReactElement } from 'react';
import { Button, CopyValue, Heading, Link, Modal, Tag } from '@/components/v2';
import { getDocsUrl } from '@/lib/docs-url';

export const ConnectLabModal = ({
  isOpen,
  toggleModalOpen,
  endpoint,
}: {
  isOpen: boolean;
  toggleModalOpen: () => void;
  endpoint: string;
}): ReactElement => {
  const docsUrl = getDocsUrl('/management/targets#registry-access-tokens') || '';

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen} className="flex w-[750px] flex-col gap-5">
      <Heading className="text-center">Use GraphQL Schema Externally</Heading>
      <p className="text-sm text-gray-500">
        Hive allow you to consume and use the Laboratory schema with your configured mocks while
        developing.
      </p>
      <span className="text-sm text-gray-500">You can use the following endpoint:</span>
      <CopyValue value={endpoint} />
      <span className="text-sm text-gray-500">
        To authenticate, use the following HTTP headers, with a token that has `target:read` scope:
      </span>
      <Tag>
        X-Hive-Key:{' '}
        <Link variant="secondary" target="_blank" rel="noreferrer" href={docsUrl}>
          YOUR_TOKEN_HERE
        </Link>
      </Tag>
      <p className="text-sm text-gray-500">
        Read the{' '}
        <Link variant="primary" target="_blank" rel="noreferrer" href={docsUrl}>
          Managing Tokens
        </Link>{' '}
        chapter in our documentation to create a Registry Access Token.
      </p>
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
