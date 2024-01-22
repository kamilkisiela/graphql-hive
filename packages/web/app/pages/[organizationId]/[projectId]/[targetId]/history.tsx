import { ReactElement, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { CheckIcon, GitCompareIcon } from 'lucide-react';
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
import { FragmentType, graphql, useFragment } from '@/gql';
import { CriticalityLevel } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { cn } from '@/lib/utils';
import {
  CheckCircledIcon,
  CrossCircledIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ExternalLinkIcon,
  ListBulletIcon,
} from '@radix-ui/react-icons';

function NoGraphChanges() {
  return (
    <div className="cursor-default">
      <div className="mb-3 flex items-center gap-3">
        <CheckCircledIcon className="h-4 w-auto text-emerald-500" />
        <h2 className="text-base font-medium text-white">No Graph Changes</h2>
      </div>
      <p className="text-muted-foreground text-xs">
        There are no changes in this graph for this schema version.
      </p>
    </div>
  );
}

function FirstComposableVersion() {
  return (
    <div className="cursor-default">
      <div className="mb-3 flex items-center gap-3">
        <CheckCircledIcon className="h-4 w-auto text-emerald-500" />
        <h2 className="text-base font-medium text-white">First composable version</h2>
      </div>
      <p className="text-muted-foreground text-xs">
        Congratulations! This is the first version of the schema that is composable.
      </p>
    </div>
  );
}

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

const SchemaVersionView_SchemaVersionFragment = graphql(`
  fragment SchemaVersionView_SchemaVersionFragment on SchemaVersion {
    id
    ...DefaultSchemaVersionView_SchemaVersionFragment
    hasSchemaChanges
    isComposable
    contractVersions {
      edges {
        node {
          id
          contractName
          hasSchemaChanges
          isComposable
          ...ContractVersionView_ContractVersionFragment
        }
      }
    }
  }
`);

function SchemaVersionView(props: {
  schemaVersion: FragmentType<typeof SchemaVersionView_SchemaVersionFragment>;
}) {
  const schemaVersion = useFragment(SchemaVersionView_SchemaVersionFragment, props.schemaVersion);

  const [selectedItem, setSelectedItem] = useState<string>('default');
  const contractVersionNode = useMemo(
    () =>
      schemaVersion.contractVersions?.edges?.find(edge => edge.node.id === selectedItem)?.node ??
      null,
    [selectedItem],
  );

  return (
    <div className="flex h-full grow flex-col">
      <div className="py-6">
        <Title>Schema Version {schemaVersion.id}</Title>
        <Subtitle>Detailed view of the schema version</Subtitle>
      </div>
      {schemaVersion.contractVersions?.edges && (
        <Tabs
          defaultValue="default"
          className="mt-3"
          value={selectedItem}
          onValueChange={value => setSelectedItem(value)}
        >
          <TabsList className="w-full justify-start rounded-b-none px-2 py-0">
            <TabsTrigger value="default" className="mt-1 py-2 data-[state=active]:rounded-b-none">
              <span>Default Graph</span>
              <TooltipProvider>
                <Tooltip>
                  {schemaVersion.hasSchemaChanges ? (
                    <>
                      <TooltipTrigger>
                        <GitCompareIcon className="h-4 w-4 pl-1" />
                      </TooltipTrigger>
                      <TooltipContent>Main graph schema changed</TooltipContent>
                    </>
                  ) : schemaVersion.isComposable ? (
                    <>
                      <TooltipTrigger>
                        <CheckIcon className="h-4 w-4 pl-1" />
                      </TooltipTrigger>
                      <TooltipContent>Composition succeeded.</TooltipContent>
                    </>
                  ) : (
                    <>
                      <TooltipTrigger>
                        <ExclamationTriangleIcon className="h-4 w-4 pl-1 text-yellow-500" />
                      </TooltipTrigger>
                      <TooltipContent>Contract composition failed.</TooltipContent>
                    </>
                  )}
                </Tooltip>
              </TooltipProvider>
            </TabsTrigger>
            {schemaVersion.contractVersions?.edges.map(edge => (
              <TabsTrigger
                value={edge.node.id}
                key={edge.node.id}
                className="mt-1 py-2 data-[state=active]:rounded-b-none"
              >
                {edge.node.contractName}
                <TooltipProvider>
                  <Tooltip>
                    {edge.node.hasSchemaChanges ? (
                      <>
                        <TooltipTrigger>
                          <GitCompareIcon className="h-4 w-4 pl-1" />
                        </TooltipTrigger>
                        <TooltipContent>Contract schema changed</TooltipContent>
                      </>
                    ) : edge.node.isComposable ? (
                      <>
                        <TooltipTrigger>
                          <CheckIcon className="h-4 w-4 pl-1" />
                        </TooltipTrigger>
                        <TooltipContent>Contract composition succeeded.</TooltipContent>
                      </>
                    ) : (
                      <>
                        <TooltipTrigger>
                          <ExclamationTriangleIcon className="h-4 w-4 pl-1 text-yellow-500" />
                        </TooltipTrigger>
                        <TooltipContent>Contract composition failed.</TooltipContent>
                      </>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      {contractVersionNode ? (
        <ContractVersionView contractVersion={contractVersionNode} />
      ) : (
        <DefaultSchemaVersionView schemaVersion={schemaVersion} />
      )}
    </div>
  );
}

const DefaultSchemaVersionView_SchemaVersionFragment = graphql(`
  fragment DefaultSchemaVersionView_SchemaVersionFragment on SchemaVersion {
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
`);

function DefaultSchemaVersionView(props: {
  schemaVersion: FragmentType<typeof DefaultSchemaVersionView_SchemaVersionFragment>;
}) {
  const schemaVersion = useFragment(
    DefaultSchemaVersionView_SchemaVersionFragment,
    props.schemaVersion,
  );
  const [selectedView, setSelectedView] = useState<string>('details');

  const availableViews: Array<{
    value: string;
    label: string | ReactElement;
    tooltip: string;
    icon: ReactElement;
    disabledReason: null | string;
  }> = [
    {
      value: 'details',
      icon: <ListBulletIcon className="h-5 w-auto flex-none" />,
      label: 'Details',
      tooltip: 'Show changes and composition errors',
      disabledReason: null,
    },
    {
      value: 'full-schema',
      icon: <DiffIcon className="h-5 w-auto flex-none" />,
      label: 'Schema',
      tooltip: 'Show diff of the schema',
      disabledReason: schemaVersion?.schemaCompositionErrors ? 'Composition failed.' : null,
    },
    {
      value: 'supergraph',
      icon: <DiffIcon className="h-5 w-auto flex-none" />,
      label: 'Supergraph',
      tooltip: 'Show diff of the supergraph',
      disabledReason: schemaVersion?.schemaCompositionErrors
        ? 'Composition failed.'
        : schemaVersion?.supergraph
          ? null
          : 'No supergraph.',
    },
  ];

  if (schemaVersion && ('service' in schemaVersion.log || 'deletedService' in schemaVersion.log)) {
    availableViews.push({
      value: 'service-schema',
      icon: <CubeIcon className="h-5 w-auto flex-none" />,
      label: 'Service',
      tooltip: 'Show diff of a service schema',
      disabledReason: null,
    });
  }

  return (
    <>
      <TooltipProvider>
        <Tabs value={selectedView} onValueChange={value => setSelectedView(value)}>
          <TabsList className="bg-background border-muted w-full justify-start rounded-none border-x border-b">
            {availableViews.map(item => (
              <Tooltip>
                <TooltipTrigger>
                  <TabsTrigger value={item.value} disabled={!!item.disabledReason}>
                    {item.icon}
                    <span className="ml-2">{item.label}</span>
                  </TabsTrigger>
                </TooltipTrigger>
                {item.disabledReason && (
                  <TooltipContent className="max-w-md p-4 font-normal">
                    {item.disabledReason}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </TabsList>
        </Tabs>
      </TooltipProvider>
      <div className="border-muted h-96 rounded-md rounded-t-none border border-t-0 p-2">
        {selectedView === 'details' && (
          <div className="my-2 px-2">
            {schemaVersion.isFirstComposableVersion ? (
              <FirstComposableVersion />
            ) : !schemaVersion.schemaCompositionErrors &&
              !schemaVersion.breakingSchemaChanges &&
              !schemaVersion.safeSchemaChanges ? (
              <NoGraphChanges />
            ) : null}
            {schemaVersion.schemaCompositionErrors && (
              <CompositionErrorsSection compositionErrors={schemaVersion.schemaCompositionErrors} />
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
        {selectedView === 'full-schema' && (
          <DiffEditor
            title="Schema"
            before={schemaVersion?.previousDiffableSchemaVersion?.sdl ?? ''}
            after={schemaVersion?.sdl ?? ''}
          />
        )}
        {selectedView === 'supergraph' && (
          <DiffEditor
            title="Supergraph"
            before={schemaVersion?.previousDiffableSchemaVersion?.supergraph ?? ''}
            after={schemaVersion?.supergraph ?? ''}
          />
        )}
        {selectedView === 'service-schema' && (
          <DiffEditor
            title="Published service diff"
            before={schemaVersion?.log?.previousServiceSdl ?? ''}
            after={('serviceSdl' in schemaVersion.log && schemaVersion.log.serviceSdl) || ''}
          />
        )}
      </div>
    </>
  );
}

const ContractVersionView_ContractVersionFragment = graphql(`
  fragment ContractVersionView_ContractVersionFragment on ContractVersion {
    id
    contractName
    isComposable
    hasSchemaChanges
    isFirstComposableVersion
    supergraphSDL
    compositeSchemaSDL
    schemaCompositionErrors {
      ...CompositionErrorsSection_SchemaErrorConnection
    }
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
    previousDiffableContractVersion {
      id
      compositeSchemaSDL
      supergraphSDL
    }
  }
`);

function ContractVersionView(props: {
  contractVersion: FragmentType<typeof ContractVersionView_ContractVersionFragment>;
}) {
  const contractVersion = useFragment(
    ContractVersionView_ContractVersionFragment,
    props.contractVersion,
  );

  const [selectedView, setSelectedView] = useState<string>('details');
  const availableViews: Array<{
    value: string;
    label: string;
    tooltip: string;
    icon: ReactElement;
    disabledReason: null | string;
  }> = [
    {
      value: 'details',
      icon: <ListBulletIcon className="h-5 w-auto flex-none" />,
      label: 'Details',
      tooltip: 'Show changes and composition errors',
      disabledReason: null,
    },
    {
      value: 'full-schema',
      icon: <DiffIcon className="h-5 w-auto flex-none" />,
      label: 'Schema',
      tooltip: 'Show diff of the schema',
      disabledReason: contractVersion?.schemaCompositionErrors ? 'Composition failed.' : null,
    },
    {
      value: 'supergraph',
      icon: <DiffIcon className="h-5 w-auto flex-none" />,
      label: 'Supergraph',
      tooltip: 'Show diff of the supergraph',
      disabledReason: contractVersion?.schemaCompositionErrors
        ? 'Composition failed.'
        : contractVersion?.supergraphSDL
          ? null
          : 'No supergraph.',
    },
  ];

  return (
    <>
      <TooltipProvider>
        <Tabs value={selectedView} onValueChange={value => setSelectedView(value)}>
          <TabsList className="bg-background border-muted w-full justify-start rounded-none border-x border-b">
            {availableViews.map(item => (
              <Tooltip>
                <TooltipTrigger>
                  <TabsTrigger value={item.value} disabled={!!item.disabledReason}>
                    {item.icon}
                    <span className="ml-2">{item.label}</span>
                  </TabsTrigger>
                </TooltipTrigger>
                {item.disabledReason && (
                  <TooltipContent className="max-w-md p-4 font-normal">
                    {item.disabledReason}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </TabsList>
        </Tabs>
      </TooltipProvider>
      <div className="border-muted h-96 rounded-md rounded-t-none border border-t-0 p-2">
        {selectedView === 'details' && (
          <div className="my-2 px-2">
            {contractVersion.isFirstComposableVersion ? (
              <FirstComposableVersion />
            ) : !contractVersion.schemaCompositionErrors &&
              !contractVersion.breakingSchemaChanges &&
              !contractVersion.safeSchemaChanges ? (
              <NoGraphChanges />
            ) : null}
            {contractVersion.schemaCompositionErrors && (
              <CompositionErrorsSection
                compositionErrors={contractVersion.schemaCompositionErrors}
              />
            )}
            {contractVersion.breakingSchemaChanges?.nodes.length && (
              <div className="mb-2">
                <ChangesBlock
                  criticality={CriticalityLevel.Breaking}
                  changes={contractVersion.breakingSchemaChanges.nodes}
                />
              </div>
            )}
            {contractVersion.safeSchemaChanges?.nodes?.length && (
              <div className="mb-2">
                <ChangesBlock
                  criticality={CriticalityLevel.Safe}
                  changes={contractVersion.safeSchemaChanges.nodes}
                />
              </div>
            )}
          </div>
        )}
        {selectedView === 'full-schema' && (
          <DiffEditor
            title="Full schema"
            before={contractVersion?.previousDiffableContractVersion?.compositeSchemaSDL ?? ''}
            after={contractVersion?.compositeSchemaSDL ?? ''}
          />
        )}
        {selectedView === 'supergraph' && (
          <DiffEditor
            title="Supergraph"
            before={contractVersion?.previousDiffableContractVersion?.supergraphSDL ?? ''}
            after={contractVersion?.supergraphSDL ?? ''}
          />
        )}
      </div>
    </>
  );
}

const ActiveSchemaVersion_SchemaVersionQuery = graphql(`
  query ActiveSchemaVersion_SchemaVersionQuery(
    $organization: ID!
    $project: ID!
    $target: ID!
    $versionId: ID!
  ) {
    target(selector: { organization: $organization, project: $project, target: $target }) {
      id
      schemaVersion(id: $versionId) {
        id
        ...SchemaVersionView_SchemaVersionFragment
      }
    }
  }
`);

function ActiveSchemaVersion({ versionId }: { versionId: string }) {
  const router = useRouteSelector();

  const [query] = useQuery({
    query: ActiveSchemaVersion_SchemaVersionQuery,
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

  if (isLoading || !schemaVersion) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
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
          {error.graphQLErrors?.[0]?.message ?? error.networkError?.message}
        </pre>
      </div>
    );
  }

  return schemaVersion ? <SchemaVersionView schemaVersion={schemaVersion} /> : null;
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
            <ActiveSchemaVersion versionId={versionId} key={versionId} />
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
