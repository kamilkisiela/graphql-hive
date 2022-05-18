import { FC } from 'react';
import NextLink from 'next/link';
import clsx from 'clsx';
import { format } from 'date-fns';
import { useQuery } from 'urql';

import {
  Activities,
  Badge,
  Button,
  Card,
  DropdownMenu,
  EmptyList,
  Heading,
  TimeAgo,
  Title,
} from '@/components/v2';
import { LinkIcon, MoreIcon, SettingsIcon } from '@/components/v2/icon';
import { TargetQuery, TargetsDocument, VersionsDocument } from '@/graphql';
import { useClipboard } from '@/lib/hooks/use-clipboard';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

// <div className="flex gap-x-5">
//   <div>
//     <Heading>Connected Targets</Heading>
//     <Card className="mt-4 flex flex-col items-center gap-y-2">
//       <NextImage
//         src="/images/figures/connection.svg"
//         alt="Connection illustration"
//         width="200"
//         height="200"
//         className="drag-none"
//       />
//       <Heading>We are building your project</Heading>
//       <span className="text-center text-sm font-medium text-gray-500">
//               Lorem ipsum dolor sit amet, consectetur adipiscing elit. Turpis et
//               dictum mattis tincidunt quis iaculis arcu proin suspendisse.
//             </span>
//       <Button size="large" className="text-orange-500 px-10">
//         New Target
//       </Button>
//     </Card>
//   </div>
//   <div>
//     <Heading>Recent Activity</Heading>
//     <Card className="mt-4 flex flex-col items-center gap-y-2">
//       <NextImage
//         src="/images/figures/ghost.svg"
//         alt="Ghost illustration"
//         width="200"
//         height="200"
//         className="drag-none"
//       />
//       <Heading>We are building your project</Heading>
//       <div className="text-center text-sm font-medium text-gray-500">
//         Lorem ipsum dolor sit amet, consectetur adipiscing elit. Turpis et
//         dictum mattis tincidunt quis iaculis arcu proin suspendisse.
//       </div>
//       <Button size="large" className="text-orange-500 px-10">
//         Add Members
//       </Button>
//     </Card>
//   </div>
// </div>

const TargetCard: FC<{
  target: TargetQuery['target'];
}> = ({ target }) => {
  const router = useRouteSelector();
  const copyToClipboard = useClipboard();
  const [versionsQuery] = useQuery({
    query: VersionsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
        target: target.cleanId,
      },
      limit: 1,
    },
    requestPolicy: 'cache-and-network',
  });
  const versions = versionsQuery.data?.schemaVersions;
  const lastVersion = versions?.nodes[0];
  const author = lastVersion?.commit.author;
  const isValid = lastVersion?.valid;
  const href = `/${router.organizationId}/${router.projectId}/${target.cleanId}`;

  return (
    <NextLink passHref href={href}>
      <Card as="a" key={target.id} className="hover:bg-gray-800/40">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="line-clamp-2 text-lg font-bold">{target.name}</h2>
          </div>
          <DropdownMenu>
            <DropdownMenu.Trigger asChild>
              <Button rotate={90}>
                <MoreIcon />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content sideOffset={5} align="start">
              <DropdownMenu.Item
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(`${window.location.origin}${href}`);
                }}
              >
                <LinkIcon />
                Share Link
              </DropdownMenu.Item>
              <NextLink
                href={`/${router.organizationId}/${router.projectId}/${target.cleanId}#settings`}
              >
                <a>
                  <DropdownMenu.Item>
                    <SettingsIcon />
                    Target Settings
                  </DropdownMenu.Item>
                </a>
              </NextLink>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
        {author && (
          <>
            <div
              className={clsx(
                'mt-2.5 mb-1.5 flex items-center gap-x-2 text-sm text-gray-500'
              )}
            >
              {lastVersion ? (
                <>
                  {isValid ? <Badge color="green" /> : <Badge color="red" />}
                  <span>{lastVersion.commit.commit.substring(0, 7)}</span>
                  <span>
                    - Published <TimeAgo date={lastVersion.date} />
                  </span>
                </>
              ) : (
                <Badge color="yellow" />
              )}
            </div>
          </>
        )}
      </Card>
    </NextLink>
  );
};

const TargetsPage: FC = () => {
  const router = useRouteSelector();
  const [targetsQuery] = useQuery({
    query: TargetsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
      },
    },
  });
  const targets = targetsQuery.data?.targets;

  return (
    <div className="flex gap-x-5">
      <Title title="Targets" />
      <div className="flex grow flex-col gap-4">
        <Heading>List of targets</Heading>
        {targets && targets.total === 0 ? (
          <EmptyList
            title="Hive is waiting for your first target"
            description='You can create a target by clicking the "New Target" button'
            docsUrl={`${process.env.NEXT_PUBLIC_DOCS_LINK}/get-started/targets`}
          />
        ) : (
          targets?.nodes.map((target) => (
            <TargetCard key={target.id} target={target} />
          ))
        )}
      </div>
      <Activities />
    </div>
  );
};

export default TargetsPage;
