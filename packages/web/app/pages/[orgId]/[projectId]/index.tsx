import { ReactElement } from 'react';
import NextLink from 'next/link';
import clsx from 'clsx';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { ProjectLayout } from '@/components/layouts';
import {
  Activities,
  Badge,
  Button,
  Card,
  EmptyList,
  Heading,
  TimeAgo,
  Title,
} from '@/components/v2';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/v2/dropdown';
import { LinkIcon, MoreIcon, SettingsIcon } from '@/components/v2/icon';
import { TargetQuery, TargetsDocument, VersionsDocument } from '@/graphql';
import { getDocsUrl } from '@/lib/docs-url';
import { useClipboard } from '@/lib/hooks/use-clipboard';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { withSessionProtection } from '@/lib/supertokens/guard';

const TargetCard = ({
  target,
}: {
  target: Exclude<TargetQuery['target'], null | undefined>;
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
  const author = lastVersion?.log && 'author' in lastVersion.log ? lastVersion.log.author : null;
  const isValid = lastVersion?.valid;
  const href = `/${router.organizationId}/${router.projectId}/${target.cleanId}`;

  return (
    <Card as={NextLink} key={target.id} className="hover:bg-gray-800/40" href={href}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="line-clamp-2 text-lg font-bold">{target.name}</h2>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button rotate={90}>
              <MoreIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent sideOffset={5} align="start">
            <DropdownMenuItem
              onClick={async e => {
                e.stopPropagation();
                await copyToClipboard(`${location.origin}${href}`);
              }}
            >
              <LinkIcon />
              Share Link
            </DropdownMenuItem>
            <NextLink
              href={`/${router.organizationId}/${router.projectId}/${target.cleanId}#settings`}
            >
              <DropdownMenuItem>
                <SettingsIcon />
                Settings
              </DropdownMenuItem>
            </NextLink>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {author && (
        <>
          <div className={clsx('mt-2.5 mb-1.5 flex items-center gap-x-2 text-sm text-gray-500')}>
            {lastVersion ? (
              <>
                <Badge color={isValid ? 'green' : 'red'} />
                <span>
                  {'commit' in lastVersion.log ? lastVersion.log.commit.substring(0, 7) : ''}
                </span>
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
  );
};

const Page = () => {
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
    <>
      <div className="flex grow flex-col gap-4">
        <Heading>List of targets</Heading>
        {targets && targets.total === 0 ? (
          <EmptyList
            title="Hive is waiting for your first target"
            description='You can create a target by clicking the "New Target" button'
            docsUrl={getDocsUrl(`/get-started/targets`)}
          />
        ) : (
          targets?.nodes.map(target => <TargetCard key={target.id} target={target} />)
        )}
      </div>
      <Activities />
    </>
  );
};

function ProjectsPage(): ReactElement {
  return (
    <>
      <Title title="Targets" />
      <ProjectLayout value="targets" className="flex gap-x-5">
        {() => <Page />}
      </ProjectLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(ProjectsPage);
