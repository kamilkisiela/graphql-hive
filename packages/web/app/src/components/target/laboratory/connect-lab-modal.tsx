import { type ReactElement } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CopyValue, Heading, Link, Modal, Tag } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { getDocsUrl } from '@/lib/docs-url';

const Laboratory_IsCDNEnabledFragment = graphql(`
  fragment Laboratory_IsCDNEnabledFragment on Query {
    isCDNEnabled
  }
`);

export const ConnectLabModal = (props: {
  isOpen: boolean;
  close: () => void;
  endpoint: string;
  isCDNEnabled: FragmentType<typeof Laboratory_IsCDNEnabledFragment> | null;
}): ReactElement => {
  const docsUrl = getDocsUrl('/management/targets#registry-access-tokens') || '';
  const isCDNEnabled = useFragment(Laboratory_IsCDNEnabledFragment, props.isCDNEnabled);

  return (
    <Modal open={props.isOpen} onOpenChange={props.close} className="flex w-[750px] flex-col gap-5">
      <Heading className="text-center">Use GraphQL Schema Externally</Heading>
      <p className="text-sm text-gray-500">
        Hive allow you to consume and use the Laboratory schema with your configured mocks while
        developing.
      </p>
      {isCDNEnabled?.isCDNEnabled ? (
        <Alert>
          <AlertTitle>High-availability CDN</AlertTitle>
          <AlertDescription>
            If you want to consume the GraphQL schema for a tool like GraphQL Code Generator, we
            instead recommend using the high-availability CDN instead.
          </AlertDescription>
        </Alert>
      ) : null}
      <span className="text-sm text-gray-500">You can use the following endpoint:</span>
      <CopyValue value={props.endpoint} />
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
      <Button type="button" size="lg" onClick={props.close} className="self-end">
        Close
      </Button>
    </Modal>
  );
};
