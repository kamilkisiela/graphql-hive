import { type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Link } from '@/components/ui/link';
import { CopyValue, Tag } from '@/components/v2';
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
  const docsUrl = getDocsUrl('/management/targets#registry-access-tokens');
  const isCDNEnabled = useFragment(
    Laboratory_IsCDNEnabledFragment,
    props.isCDNEnabled,
  )?.isCDNEnabled;

  return (
    <ConnectLabModalContent
      isOpen={props.isOpen}
      close={props.close}
      endpoint={props.endpoint}
      isCDNEnabled={isCDNEnabled}
      docsUrl={docsUrl}
    />
  );
};

export const ConnectLabModalContent = (props: {
  isOpen: boolean;
  close: () => void;
  endpoint: string;
  isCDNEnabled?: boolean;
  docsUrl: string;
}) => {
  return (
    <Dialog open={props.isOpen} onOpenChange={props.close}>
      <DialogContent className="w-4/5 max-w-[600px] md:w-3/5">
        <DialogHeader>
          <DialogTitle>Use GraphQL Schema Externally</DialogTitle>
          <DialogDescription>
            Hive allow you to consume and use the Laboratory schema with your configured mocks while
            developing.
          </DialogDescription>
        </DialogHeader>
        {props?.isCDNEnabled ? (
          <div>
            <h3 className="text-sm text-white">High-availability CDN:</h3>
            <Callout className="mt-2" type="info">
              If you want to consume the GraphQL schema for a tool like GraphQL Code Generator, we
              instead recommend using the high-availability CDN instead.
            </Callout>
          </div>
        ) : null}
        <span className="text-sm text-white">You can use the following endpoint:</span>
        <CopyValue value={props.endpoint} />
        <span className="text-sm text-white">
          To authenticate, use the following HTTP headers, with a token that has `target:read`
          scope:
        </span>
        <Tag>
          X-Hive-Key:
          <Link
            as="a"
            variant="secondary"
            target="_blank"
            className="underline underline-offset-2"
            rel="noreferrer"
            href={props.docsUrl}
          >
            YOUR_TOKEN_HERE
          </Link>
        </Tag>
        <p className="text-sm text-gray-500">
          Read the{' '}
          <Link as="a" variant="primary" target="_blank" rel="noreferrer" href={props.docsUrl}>
            Managing Tokens
          </Link>{' '}
          chapter in our documentation to create a Registry Access Token.
        </p>
        <DialogFooter className="gap-2">
          <Button
            variant="default"
            onClick={ev => {
              ev.preventDefault();
              props.close();
            }}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
