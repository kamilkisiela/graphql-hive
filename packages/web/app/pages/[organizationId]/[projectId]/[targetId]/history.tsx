import { ReactElement, useCallback, useState } from 'react';
import NextLink from 'next/link';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Page, TargetLayout } from '@/components/layouts/target';
import {
  ChangesBlock,
  CompositionErrorsSection,
} from '@/components/target/history/errors-and-changes';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge, Button, DiffEditor, MetaTitle, Spinner, TimeAgo } from '@/components/v2';
import { noSchemaVersion } from '@/components/v2/empty-list';
import { DiffIcon } from '@/components/v2/icon';
import { graphql } from '@/gql';
import { CriticalityLevel } from '@/graphql';
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

const HistoryPage_VersionsPageQuery = graphql(`
  query HistoryPage_VersionsPageQuery(
    $organization: ID!
    $project: ID!
    $target: ID!
    $first: Int!
    $after: String
  ) {
    target(selector: { organization: $organization, project: $project, target: $target }) {
      id
      schemaVersions(first: $first, after: $after) {
        edges {
          node {
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
            githubMetadata {
              repository
              commit
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`);

// URQL's Infinite scrolling pattern
// https://formidable.com/open-source/urql/docs/basics/ui-patterns/#infinite-scrolling
function ListPage({
  variables,
  isLastPage,
  onLoadMore,
  versionId,
}: {
  variables: { after: string | null; first: number };
  isLastPage: boolean;
  onLoadMore: (after: string) => void;
  versionId: string;
}): ReactElement {
  const router = useRouteSelector();

  const [versionsQuery] = useQuery({
    query: HistoryPage_VersionsPageQuery,
    variables: {
      organization: router.organizationId,
      project: router.projectId,
      target: router.targetId,
      ...variables,
    },
    requestPolicy: 'cache-and-network',
  });

  const edges = versionsQuery.data?.target?.schemaVersions.edges;
  const hasMore = versionsQuery.data?.target?.schemaVersions?.pageInfo?.hasNextPage ?? false;

  return (
    <>
      {edges?.map(({ node: version }) => (
        <div
          className={cn(
            'flex flex-col rounded-md p-2.5 hover:bg-gray-800/40',
            versionId === version.id && 'bg-gray-800/40',
          )}
        >
          <NextLink
            key={version.id}
            href={{
              pathname: '/[organizationId]/[projectId]/[targetId]/history/[versionId]',
              query: {
                organizationId: router.organizationId,
                projectId: router.projectId,
                targetId: router.targetId,
                versionId: version.id,
              },
            }}
            scroll={false} // disable the scroll to top on page
          >
            <h3 className="truncate text-sm font-semibold">
              {'commit' in version.log
                ? version.log.commit
                : `Deleted ${version.log.deletedService}`}
            </h3>
            {'author' in version.log ? (
              <div className="truncate text-xs font-medium text-gray-500">
                <span className="overflow-hidden truncate">{version.log.author}</span>
              </div>
            ) : null}
            <div className="mb-1.5 mt-2.5 flex align-middle text-xs font-medium text-[#c4c4c4]">
              <div className={cn(!version.valid && 'text-red-500')}>
                <Badge color={version.valid ? 'green' : 'red'} /> Published{' '}
                <TimeAgo date={version.date} />
              </div>

              {'service' in version.log && version.log.service ? (
                <div className="ml-auto mr-0 w-1/2 truncate text-right font-bold">
                  {version.log.service}
                </div>
              ) : null}
            </div>
          </NextLink>
          {version.githubMetadata ? (
            <a
              className="ml-[-1px] text-xs font-medium text-gray-500 hover:text-gray-400"
              target="_blank"
              rel="noreferrer"
              href={`https://github.com/${version.githubMetadata.repository}/commit/${version.githubMetadata.commit}`}
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
            const endCursor = versionsQuery.data?.target?.schemaVersions?.pageInfo?.endCursor;
            if (endCursor) {
              onLoadMore(endCursor);
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

const ComparisonView_SchemaVersionQuery = graphql(`
  query ComparisonView_SchemaVersionQuery(
    $organization: ID!
    $project: ID!
    $target: ID!
    $versionId: ID!
  ) {
    target(selector: { organization: $organization, project: $project, target: $target }) {
      id
      schemaVersion(id: $versionId) {
        id
        log {
          ... on PushedSchemaLog {
            id
            author
            service
            commit
            serviceSdl
            previousServiceSdl
          }
          ... on DeletedSchemaLog {
            id
            deletedService
            previousServiceSdl
          }
        }
        supergraph
        sdl
        schemaCompositionErrors {
          ...CompositionErrorsSection_SchemaErrorConnection
        }
        isFirstComposableVersion
        breakingSchemaChanges {
          nodes {
            message(withSafeBasedOnUsageNote: false)
            criticality
            criticalityReason
            path
            approval {
              approvedBy {
                id
                displayName
              }
              approvedAt
              schemaCheckId
            }
            isSafeBasedOnUsage
          }
        }
        safeSchemaChanges {
          nodes {
            message(withSafeBasedOnUsageNote: false)
            criticality
            criticalityReason
            path
            approval {
              approvedBy {
                id
                displayName
              }
              approvedAt
              schemaCheckId
            }
            isSafeBasedOnUsage
          }
        }
        previousDiffableSchemaVersion {
          id
          supergraph
          sdl
        }
      }
    }
  }
`);

function ComparisonView({ versionId }: { versionId: string }) {
  const router = useRouteSelector();
  const [view, setView] = useState<View>('list');
  const onViewChange = useCallback((view: View) => {
    setView(view);
  }, []);

  const [query] = useQuery({
    query: ComparisonView_SchemaVersionQuery,
    variables: {
      organization: router.organizationId,
      project: router.projectId,
      target: router.targetId,
      versionId,
    },
  });

  const { error } = query;

  const isLoading = query.fetching;
  const schemaVersion = query?.data?.target?.schemaVersion;

  const availableViews: Array<{
    value: View;
    label: string;
    tooltip: string;
    icon: ReactElement;
    disabledReason: null | string;
  }> = [
    {
      value: 'list',
      icon: <ListBulletIcon className="h-5 w-auto  flex-none" />,
      label: 'Detail',
      tooltip: 'Show changes and composition errors',
      disabledReason: null,
    },

    {
      value: 'full-schema',
      icon: <DiffIcon className="h-5 w-auto flex-none" />,
      label: 'Schema Diff',
      tooltip: 'Show diff of a full schema',
      disabledReason:
        schemaVersion?.sdl && schemaVersion?.previousDiffableSchemaVersion?.sdl
          ? null
          : 'Composition failed.',
    },
  ];

  if (schemaVersion && ('service' in schemaVersion.log || 'deletedService' in schemaVersion.log)) {
    availableViews.push({
      value: 'service-schema',
      icon: <CubeIcon className="h-5 w-auto flex-none" />,
      label: 'Service Diff',
      tooltip: 'Show diff of a service schema',
      disabledReason:
        schemaVersion?.log.previousServiceSdl &&
        'serviceSdl' in schemaVersion.log &&
        schemaVersion.log.serviceSdl
          ? null
          : 'No service schema changes',
    });
  }

  return (
    <>
      <div className="flex flex-row items-center justify-between">
        <div className="py-6">
          <Title>Details</Title>
          <Subtitle>Explore details of the selected version</Subtitle>
        </div>
        {availableViews.length ? (
          <TooltipProvider>
            <div className="flex items-center justify-between">
              <Tabs
                // className="flex space-x-1 rounded-md bg-gray-900/50 p-0.5 text-gray-500"
                defaultValue={availableViews[0]?.value}
                onValueChange={value => onViewChange(value as View)}
              >
                <TabsList>
                  {availableViews.map(({ value, icon, label, tooltip, disabledReason }) => (
                    <Tooltip>
                      <TooltipTrigger>
                        <TabsTrigger
                          key={value}
                          value={value}
                          className={cn(
                            'hover:text-white disabled:hover:text-gray-500',
                            view === value && 'bg-gray-800 text-white',
                          )}
                          title={tooltip}
                          disabled={!!disabledReason}
                        >
                          {icon}
                          <span className="ml-2">{label}</span>
                        </TabsTrigger>
                      </TooltipTrigger>
                      {disabledReason && (
                        <TooltipContent className="max-w-md p-4 font-normal">
                          {disabledReason}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </TooltipProvider>
        ) : null}
      </div>
      <div className="flex h-full">
        <div className="grow overflow-y-auto rounded-md">
          {isLoading || !schemaVersion ? (
            <div className="flex h-full w-full items-center justify-center">
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
          ) : null}
          {schemaVersion && (
            <>
              {view === 'list' && schemaVersion && (
                <div>
                  {schemaVersion.isFirstComposableVersion && (
                    <div className="cursor-default">
                      <div className="m-3 p-4">
                        <div className="mb-3 flex items-center gap-3">
                          <CheckCircledIcon className="h-4 w-auto text-emerald-500" />
                          <h2 className="text-base font-medium text-white">
                            First composable version
                          </h2>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          Congratulations! This is the first version of the schema that is
                          composable.
                        </p>
                      </div>
                    </div>
                  )}
                  {schemaVersion.schemaCompositionErrors && (
                    <CompositionErrorsSection
                      compositionErrors={schemaVersion.schemaCompositionErrors}
                    />
                  )}
                  {schemaVersion.breakingSchemaChanges?.nodes.length && (
                    <div className="mb-2">
                      <ChangesBlock
                        criticality={CriticalityLevel.Breaking}
                        changes={schemaVersion.breakingSchemaChanges.nodes}
                      />
                    </div>
                  )}
                  {schemaVersion.safeSchemaChanges?.nodes?.length && (
                    <div className="mb-2">
                      <ChangesBlock
                        criticality={CriticalityLevel.Safe}
                        changes={schemaVersion.safeSchemaChanges.nodes}
                      />
                    </div>
                  )}
                </div>
              )}
              {view === 'full-schema' && (
                <DiffEditor
                  title="Full schema"
                  before={schemaVersion?.previousDiffableSchemaVersion?.sdl ?? ''}
                  after={schemaVersion?.sdl ?? ''}
                />
              )}
              {view === 'service-schema' && (
                <DiffEditor
                  title="Published service diff"
                  before={schemaVersion?.log?.previousServiceSdl ?? ''}
                  after={('serviceSdl' in schemaVersion.log && schemaVersion.log.serviceSdl) || ''}
                />
              )}
            </>
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
        id
        ...TargetLayout_CurrentOrganizationFragment
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      id
      ...TargetLayout_CurrentProjectFragment
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
      latestSchemaVersion {
        id
      }
    }
    me {
      id
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
  const [pageVariables, setPageVariables] = useState([{ first: 10, after: null as string | null }]);

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const currentProject = query.data?.project;
  const currentTarget = query.data?.target;
  const organizationConnection = query.data?.organizations;
  const isCDNEnabled = query.data;

  const versionId = router.versionId || currentTarget?.latestSchemaVersion?.id;

  return (
    <TargetLayout
      page={Page.History}
      className="h-full"
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      me={me ?? null}
      organizations={organizationConnection ?? null}
      isCDNEnabled={isCDNEnabled ?? null}
    >
      {versionId ? (
        <div className="flex h-full w-full flex-row gap-x-6">
          <div>
            <div className="py-6">
              <Title>Versions</Title>
              <Subtitle>Recently published schemas.</Subtitle>
            </div>
            <div className="flex flex-col gap-5">
              <div className="flex min-w-[420px] grow flex-col gap-2.5 overflow-y-auto rounded-md border border-gray-800/50 bg-gray-900/50 p-2.5">
                {pageVariables.map((variables, i) => (
                  <ListPage
                    key={variables.after || 'initial'}
                    variables={variables}
                    isLastPage={i === pageVariables.length - 1}
                    onLoadMore={after => {
                      setPageVariables([...pageVariables, { after, first: 10 }]);
                    }}
                    versionId={versionId}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="grow">
            <ComparisonView versionId={versionId} key={versionId} />
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

export const getServerSideProps = withSessionProtection();

export default authenticated(HistoryPage);
