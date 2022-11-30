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
  const docsUrl = getDocsUrl('/features/tokens') || '';

  return (
    <Modal open={isOpen} onOpenChange={toggleModalOpen} className="flex w-[650px] flex-col gap-5">
      <Heading className="text-center">Connect to Lab</Heading>
      <p className="text-sm text-gray-500">
        Hive allow you to consume and use this schema with your configured mocks while developing.
      </p>
      <span className="text-sm text-gray-500">You can use the following endpoint:</span>
      <CopyValue value={endpoint} />
      <span className="text-sm text-gray-500">
        To authenticate, use the following HTTP headers:
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
        chapter in our documentation.
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
