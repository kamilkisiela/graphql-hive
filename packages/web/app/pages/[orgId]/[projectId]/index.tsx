import { ReactElement } from 'react';
import NextLink from 'next/link';
import clsx from 'clsx';
import { useQuery } from 'urql';

import { ProjectLayout } from '@/components/layouts';
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

const TargetCard = ({
  target,
}: {
  target: TargetQuery['target'];
}): ReactElement => {
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
                  <Badge color={isValid ? 'green' : 'red'} />
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

export default function ProjectsPage(): ReactElement {
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
    <ProjectLayout value="targets" className="flex gap-x-5">
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
    </ProjectLayout>
  );
}
