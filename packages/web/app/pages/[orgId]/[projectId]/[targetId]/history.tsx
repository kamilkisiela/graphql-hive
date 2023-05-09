import { ReactElement, useCallback, useState } from 'react';
import NextLink from 'next/link';
import { clsx } from 'clsx';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { VersionErrorsAndChanges } from '@/components/target/history/errors-and-changes';
import {
  Badge,
  Button,
  DiffEditor,
  Heading,
  TimeAgo,
  Title,
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/v2';
import { noSchemaVersion } from '@/components/v2/empty-list';
import { DiffIcon } from '@/components/v2/icon';
import { graphql } from '@/gql';
import { CompareDocument, VersionsDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { withSessionProtection } from '@/lib/supertokens/guard';
import {
  CheckCircledIcon,
  CrossCircledIcon,
  ExternalLinkIcon,
  RowsIcon,
} from '@radix-ui/react-icons';

function DiffView({
  view,
  versionId,
}: {
  view: 'SDL' | 'list';
  versionId: string;
}): ReactElement | null {
  const router = useRouteSelector();
  const [compareQuery] = useQuery({
    query: CompareDocument,
    variables: {
      organization: router.organizationId,
      project: router.projectId,
      target: router.targetId,
      version: versionId,
      unstable_forceLegacyComparison: router.query['force-legacy-comparison'] === '1',
    },
  });

  const comparison = compareQuery.data?.schemaCompareToPrevious;
  const compositionErrors = compareQuery.data?.schemaVersion?.errors;
  const { error } = compareQuery;

  if (error) {
    const errorMessage = error.graphQLErrors?.[0]?.message ?? error.networkError?.message;

    return (
      <div className="m-3 rounded-lg bg-red-500/20 p-8">
        <div className="mb-3 flex items-center gap-3">
          <CrossCircledIcon className="h-6 w-auto text-red-500" />
          <h2 className="text-lg font-medium text-white">Failed to compare schemas</h2>
        </div>
        <p className="text-base text-gray-500">
          Previous or current schema is most likely incomplete and was force published
        </p>
        <pre className="mt-5 whitespace-pre-wrap rounded-lg bg-red-900 p-3 text-xs text-white">
          {errorMessage}
        </pre>
      </div>
    );
  }

  if (!comparison || !compositionErrors) {
    return null;
  }

  const isComparisonSuccessful = comparison.__typename !== 'SchemaCompareError';

  if (isComparisonSuccessful && view === 'SDL') {
    const { before, after } = comparison.diff;
    return <DiffEditor before={before} after={after} />;
  }

  const hasChanges = isComparisonSuccessful && comparison.changes.total > 0;
  const hasErrors = compositionErrors.total > 0;

  if (!hasChanges && !hasErrors) {
    return (
      <div>
        <div className="m-3 rounded-lg bg-emerald-500/20 p-8">
          <div className="mb-3 flex items-center gap-3">
            <CheckCircledIcon className="h-6 w-auto text-emerald-500" />
            <h2 className="text-lg font-medium text-white">First composable version</h2>
          </div>
          <p className="text-base text-white">
            Congratulations! This is the first version of the schema that is composable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <VersionErrorsAndChanges
      changes={
        isComparisonSuccessful
          ? comparison.changes
          : {
              nodes: [],
              total: 0,
            }
      }
      errors={compositionErrors}
    />
  );
}

// URQL's Infinite scrolling pattern
// https://formidable.com/open-source/urql/docs/basics/ui-patterns/#infinite-scrolling
function ListPage({
  gitRepository,
  variables,
  isLastPage,
  onLoadMore,
  versionId,
}: {
  gitRepository?: string;
  variables: { after: string; limit: number };
  isLastPage: boolean;
  onLoadMore: (after: string) => void;
  versionId: string;
}): ReactElement {
  const router = useRouteSelector();

  const [versionsQuery] = useQuery({
    query: VersionsDocument,
    variables: {
      selector: {
        organization: router.organizationId,
        project: router.projectId,
        target: router.targetId,
      },
      ...variables,
    },
    requestPolicy: 'cache-and-network',
  });

  const versions = versionsQuery.data?.schemaVersions;
  const hasMore = versions?.pageInfo.hasNextPage;

  return (
    <>
      {versions?.nodes.map(version => (
        <div
          className={clsx(
            'flex flex-col rounded-md p-2.5 hover:bg-gray-800/40',
            versionId === version.id && 'bg-gray-800/40',
          )}
        >
          <NextLink
            key={version.id}
            href={`/${router.organizationId}/${router.projectId}/${router.targetId}/history/${version.id}`}
            scroll={false} // disable the scroll to top on page
          >
            <h3 className="truncate font-bold">
              {'commit' in version.log
                ? version.log.commit
                : `Deleted ${version.log.deletedService}`}
            </h3>
            {'author' in version.log ? (
              <div className="truncate text-xs font-medium text-gray-500">
                <span className="overflow-hidden truncate">{version.log.author}</span>
              </div>
            ) : null}
            <div className="mt-2.5 mb-1.5 flex align-middle text-xs font-medium text-[#c4c4c4]">
              <div className={clsx('w-1/2 ', !version.valid && 'text-red-500')}>
                <Badge color={version.valid ? 'green' : 'red'} /> Published{' '}
                <TimeAgo date={version.date} />
              </div>

              {'service' in version.log && version.log.service ? (
                <div className="ml-auto mr-0 w-1/2 overflow-hidden text-ellipsis whitespace-nowrap text-right font-bold">
                  {version.log.service}
                </div>
              ) : null}
            </div>
          </NextLink>
          {gitRepository && 'commit' in version.log && version.log.commit ? (
            <a
              className="text-xs font-medium text-gray-500 hover:text-gray-400"
              target="_blank"
              rel="noreferrer"
              href={`https://github.com/${gitRepository}/commit/${version.log.commit}`}
            >
              <ExternalLinkIcon className="inline" /> associated with Git commit
            </a>
          ) : null}
        </div>
      ))}
      {isLastPage && hasMore && (
        <Button
          variant="link"
          onClick={() => {
            const id = versions.nodes.at(-1)?.id;
            if (id) {
              onLoadMore(id);
            }
          }}
        >
          Load more
        </Button>
      )}
    </>
  );
}

type View = 'SDL' | 'list';

function Page({ versionId, gitRepository }: { versionId: string; gitRepository?: string }) {
  const [pageVariables, setPageVariables] = useState([{ limit: 10, after: '' }]);

  const [view, setView] = useState<View>('list');
  const onViewChange = useCallback((view: View) => {
    setView(view);
  }, []);

  return (
    <>
      <div className="flex flex-col gap-5">
        <Heading>Versions</Heading>
        <div className="flex h-0 min-w-[420px] grow flex-col gap-2.5 overflow-y-auto rounded-md border border-gray-800/50 p-2.5">
          {pageVariables.map((variables, i) => (
            <ListPage
              gitRepository={gitRepository}
              key={variables.after || 'initial'}
              variables={variables}
              isLastPage={i === pageVariables.length - 1}
              onLoadMore={after => {
                setPageVariables([...pageVariables, { after, limit: 10 }]);
              }}
              versionId={versionId}
            />
          ))}
        </div>
      </div>
      <div className="flex grow flex-col gap-4">
        <div className="flex items-center justify-between">
          <Heading>Schema</Heading>
          <ToggleGroup
            defaultValue="list"
            onValueChange={onViewChange}
            type="single"
            className="bg-gray-900/50 text-gray-500"
          >
            {[
              { value: 'SDL', icon: <DiffIcon className="h-5 w-auto" /> },
              { value: 'list', icon: <RowsIcon /> },
            ].map(({ value, icon }) => (
              <ToggleGroupItem
                key={value}
                value={value}
                title={`Show ${value}`}
                className={clsx('hover:text-white', view === value && 'bg-gray-800 text-white')}
              >
                {icon}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="grow rounded-md border border-gray-800/50 overflow-y-auto">
          <DiffView versionId={versionId} view={view} />
        </div>
      </div>
    </>
  );
}

const TargetHistoryPageQuery = graphql(`
  query TargetHistoryPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_OrganizationFragment
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_ProjectFragment
      gitRepository
    }
    targets(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_TargetConnectionFragment
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
      latestSchemaVersion {
        id
      }
    }
    ...TargetLayout_IsCDNEnabledFragment
  }
`);

function HistoryPage(): ReactElement {
  const router = useRouteSelector();

  return (
    <>
      <Title title="History" />
      <TargetLayout
        value="history"
        className="flex h-full items-stretch gap-x-5"
        query={TargetHistoryPageQuery}
      >
        {({ target, project }) => {
          const versionId = router.versionId ?? target?.latestSchemaVersion?.id;
          return versionId ? (
            <Page gitRepository={project?.gitRepository ?? undefined} versionId={versionId} />
          ) : (
            noSchemaVersion
          );
        }}
      </TargetLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(HistoryPage);
