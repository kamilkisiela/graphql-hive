import { ReactElement, useCallback, useState } from 'react';
import NextLink from 'next/link';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts/target';
import { VersionErrorsAndChanges } from '@/components/target/history/errors-and-changes';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { Badge, Button, DiffEditor, MetaTitle, Spinner, TimeAgo } from '@/components/v2';
import { noSchemaVersion } from '@/components/v2/empty-list';
import { DiffIcon } from '@/components/v2/icon';
import { graphql } from '@/gql';
import { CompareDocument } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { cn } from '@/lib/utils';
import {
  CheckCircledIcon,
  CrossCircledIcon,
  CubeIcon,
  ExternalLinkIcon,
  ListBulletIcon,
} from '@radix-ui/react-icons';
import * as ToggleGroup from '@radix-ui/react-toggle-group';

const HistoryPage_VersionsPageQuery = graphql(`
  query HistoryPage_VersionsPageQuery($selector: SchemaVersionsInput!, $limit: Int!, $after: ID) {
    schemaVersions(selector: $selector, after: $after, limit: $limit) {
      nodes {
        id
        date
        valid
        log {
          ... on PushedSchemaLog {
            id
            author
            service
            commit
          }
          ... on DeletedSchemaLog {
            id
            deletedService
          }
        }
        baseSchema
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`);

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
    query: HistoryPage_VersionsPageQuery,
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
          className={cn(
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
              <div className={cn('w-1/2 ', !version.valid && 'text-red-500')}>
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

type View = 'full-schema' | 'list' | 'service-schema';

function ComparisonView({ versionId }: { versionId: string }) {
  const router = useRouteSelector();
  const [view, setView] = useState<View>('list');
  const onViewChange = useCallback((view: View) => {
    setView(view);
  }, []);
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

  const isComparisonSuccessful = comparison?.__typename === 'SchemaCompareResult';
  const hasSchemaChanges = isComparisonSuccessful && comparison.changes.total > 0;
  const hasCompositionErrors = !!compositionErrors && compositionErrors.total > 0;

  const isListViewAvailable = hasSchemaChanges || hasCompositionErrors;
  const isFullSchemaDiffAvailable = isComparisonSuccessful && hasSchemaChanges;
  const isServiceSchemaAvailable = isComparisonSuccessful && comparison.service != null;

  const showFullSchemaDiff = isFullSchemaDiffAvailable && view === 'full-schema';
  const showServiceSchemaDiff = isServiceSchemaAvailable && view === 'service-schema';
  const showListView = isListViewAvailable && view === 'list';

  const isLoading = compareQuery.fetching;

  const availableViews = (
    [
      isListViewAvailable
        ? {
            value: 'list',
            icon: <ListBulletIcon className="h-5 w-auto  flex-none" />,
            label: 'Changes',
            tooltip: 'Show changes and composition errors',
          }
        : null,
      isFullSchemaDiffAvailable
        ? {
            value: 'full-schema',
            icon: <DiffIcon className="h-5 w-auto flex-none" />,
            label: 'Full Diff',
            tooltip: 'Show diff of a full schema',
          }
        : null,
      isServiceSchemaAvailable
        ? {
            value: 'service-schema',
            icon: <CubeIcon className="h-5 w-auto flex-none" />,
            label: 'Service Diff',
            tooltip: 'Show diff of a service schema',
          }
        : null,
    ] satisfies Array<{
      value: View;
      label: string;
      tooltip: string;
      icon: ReactElement;
    } | null>
  ).filter(isDefined);

  return (
    <>
      <div className="flex flex-row justify-between items-center">
        <div className="py-6">
          <Title>Details</Title>
          <Subtitle>Explore details of the selected version</Subtitle>
        </div>
        {availableViews.length ? (
          <div className="flex items-center justify-between">
            <ToggleGroup.Root
              className="flex space-x-1 rounded-md bg-gray-900/50 text-gray-500 p-0.5"
              type="single"
              defaultValue={availableViews[0]?.value}
              onValueChange={onViewChange}
              orientation="vertical"
            >
              {availableViews.map(({ value, icon, label, tooltip }) => (
                <ToggleGroup.Item
                  key={value}
                  value={value}
                  className={cn(
                    'flex items-center rounded-md py-[0.4375rem] px-2 text-xs font-semibold hover:text-white',
                    view === value && 'bg-gray-800 text-white',
                  )}
                  title={tooltip}
                >
                  {icon}
                  <span className="ml-2">{label}</span>
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
          </div>
        ) : null}
      </div>
      <div className="flex h-full">
        <div className="grow rounded-md overflow-y-auto">
          {isLoading ? (
            <div className="flex w-full h-full justify-center items-center">
              <Spinner />
            </div>
          ) : error ? (
            <div className="m-3 rounded-lg bg-red-500/20 p-8">
              <div className="mb-3 flex items-center gap-3">
                <CrossCircledIcon className="h-6 w-auto text-red-500" />
                <h2 className="text-lg font-medium text-white">Failed to compare schemas</h2>
              </div>
              <p className="text-base text-gray-500">
                Previous or current schema is most likely incomplete and was force published
              </p>
              <pre className="mt-5 whitespace-pre-wrap rounded-lg bg-red-900 p-3 text-xs text-white">
                {error.graphQLErrors?.[0]?.message ?? error.networkError?.message}
              </pre>
            </div>
          ) : showFullSchemaDiff ? (
            <DiffEditor
              title="Full schema"
              before={comparison.diff.before ?? ''}
              after={comparison.diff.after}
            />
          ) : showServiceSchemaDiff ? (
            <DiffEditor
              title={comparison.service?.name ?? ''}
              before={comparison.service?.before ?? ''}
              after={comparison.service?.after ?? ''}
            />
          ) : showListView ? (
            <VersionErrorsAndChanges
              changes={
                hasSchemaChanges
                  ? comparison.changes
                  : {
                      nodes: [],
                      total: 0,
                    }
              }
              errors={
                hasCompositionErrors
                  ? compositionErrors
                  : {
                      nodes: [],
                      total: 0,
                    }
              }
            />
          ) : isServiceSchemaAvailable ? (
            <DiffEditor
              title={comparison.service?.name ?? ''}
              before={comparison.service?.before ?? ''}
              after={comparison.service?.after ?? ''}
            />
          ) : (
            <div>
              <div className="m-3 p-4">
                <div className="mb-3 flex items-center gap-3">
                  <CheckCircledIcon className="h-4 w-auto text-emerald-500" />
                  <h2 className="text-base font-medium text-white">First composable version</h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Congratulations! This is the first version of the schema that is composable.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const TargetHistoryPageQuery = graphql(`
  query TargetHistoryPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    organizations {
      ...TargetLayout_OrganizationConnectionFragment
    }
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_CurrentOrganizationFragment
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_CurrentProjectFragment
      gitRepository
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
      latestSchemaVersion {
        id
      }
    }
    me {
      ...TargetLayout_MeFragment
    }
    ...TargetLayout_IsCDNEnabledFragment
  }
`);

function HistoryPageContent() {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: TargetHistoryPageQuery,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
      targetId: router.targetId,
    },
  });
  const [pageVariables, setPageVariables] = useState([{ limit: 10, after: '' }]);

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const currentProject = query.data?.project;
  const currentTarget = query.data?.target;
  const organizationConnection = query.data?.organizations;
  const isCDNEnabled = query.data;

  const versionId = router.versionId ?? currentTarget?.latestSchemaVersion?.id;

  return (
    <TargetLayout
      value="history"
      className="h-full"
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      me={me ?? null}
      organizations={organizationConnection ?? null}
      isCDNEnabled={isCDNEnabled ?? null}
    >
      {versionId ? (
        <div className="flex w-full h-full flex-row gap-x-6">
          <div>
            <div className="py-6">
              <Title>Versions</Title>
              <Subtitle>Recently published schemas.</Subtitle>
            </div>
            <div className="flex flex-col gap-5">
              <div className="flex min-w-[420px] grow flex-col gap-2.5 overflow-y-auto rounded-md border border-gray-800/50 p-2.5">
                {pageVariables.map((variables, i) => (
                  <ListPage
                    gitRepository={currentProject?.gitRepository ?? undefined}
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
          </div>
          <div className="grow">
            <ComparisonView versionId={versionId} />
          </div>
        </div>
      ) : (
        <>
          <div className="py-6">
            <Title>Versions</Title>
            <Subtitle>Recently published schemas.</Subtitle>
          </div>
          {query.fetching ? null : noSchemaVersion}
        </>
      )}
    </TargetLayout>
  );
}

function HistoryPage(): ReactElement {
  return (
    <>
      <MetaTitle title="History" />
      <HistoryPageContent />
    </>
  );
}

function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

export const getServerSideProps = withSessionProtection();

export default authenticated(HistoryPage);
