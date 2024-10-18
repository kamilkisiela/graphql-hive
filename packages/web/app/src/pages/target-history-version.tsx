import { ReactElement, useMemo, useState } from 'react';
import { CheckIcon, GitCompareIcon } from 'lucide-react';
import { useQuery } from 'urql';
import {
  ChangesBlock,
  CompositionErrorsSection,
  NoGraphChanges,
} from '@/components/target/history/errors-and-changes';
import { DiffIcon } from '@/components/ui/icon';
import { Subtitle, Title } from '@/components/ui/page';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DiffEditor } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { CriticalityLevel, ProjectType } from '@/gql/graphql';
import { cn } from '@/lib/utils';
import {
  CheckCircledIcon,
  CrossCircledIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  ListBulletIcon,
} from '@radix-ui/react-icons';

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
  projectType: ProjectType;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
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
    <div className="flex w-full flex-col">
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
                        <GitCompareIcon className="size-4 pl-1" />
                      </TooltipTrigger>
                      <TooltipContent>Main graph schema changed</TooltipContent>
                    </>
                  ) : schemaVersion.isComposable ? (
                    <>
                      <TooltipTrigger>
                        <CheckIcon className="size-4 pl-1" />
                      </TooltipTrigger>
                      <TooltipContent>Composition succeeded.</TooltipContent>
                    </>
                  ) : (
                    <>
                      <TooltipTrigger>
                        <ExclamationTriangleIcon className="size-4 pl-1 text-yellow-500" />
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
                          <GitCompareIcon className="size-4 pl-1" />
                        </TooltipTrigger>
                        <TooltipContent>Contract schema changed</TooltipContent>
                      </>
                    ) : edge.node.isComposable ? (
                      <>
                        <TooltipTrigger>
                          <CheckIcon className="size-4 pl-1" />
                        </TooltipTrigger>
                        <TooltipContent>Contract composition succeeded.</TooltipContent>
                      </>
                    ) : (
                      <>
                        <TooltipTrigger>
                          <ExclamationTriangleIcon className="size-4 pl-1 text-yellow-500" />
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
        <ContractVersionView
          contractVersion={contractVersionNode}
          projectType={props.projectType}
          organizationSlug={props.organizationSlug}
          projectSlug={props.projectSlug}
          targetSlug={props.targetSlug}
        />
      ) : (
        <DefaultSchemaVersionView
          organizationSlug={props.organizationSlug}
          projectSlug={props.projectSlug}
          targetSlug={props.targetSlug}
          schemaVersion={schemaVersion}
          projectType={props.projectType}
          hasContracts={!!schemaVersion.contractVersions?.edges}
        />
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
        ...ChangesBlock_SchemaChangeFragment
      }
    }
    safeSchemaChanges {
      nodes {
        ...ChangesBlock_SchemaChangeFragment
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
  projectType: ProjectType;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  hasContracts: boolean;
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
  ];

  if (props.projectType === ProjectType.Federation) {
    availableViews.push({
      value: 'supergraph',
      icon: <DiffIcon className="h-5 w-auto flex-none" />,
      label: 'Supergraph',
      tooltip: 'Show diff of the supergraph',
      disabledReason: schemaVersion?.schemaCompositionErrors
        ? 'Composition failed.'
        : schemaVersion?.supergraph
          ? null
          : 'No supergraph.',
    });
  }

  if (props.projectType !== ProjectType.Single) {
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
          <TabsList
            className={cn(
              'bg-background border-muted w-full justify-start rounded-none border-x border-b',
              !props.hasContracts && 'rounded-t border-t',
            )}
          >
            {availableViews.map(item => (
              <Tooltip key={item.value}>
                <TooltipTrigger>
                  <TabsTrigger value={item.value} disabled={!!item.disabledReason} asChild>
                    <span>
                      {item.icon}
                      <span className="ml-2">{item.label}</span>
                    </span>
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
      <div className="border-muted grow rounded-md rounded-t-none border border-t-0">
        {selectedView === 'details' && (
          <div className="my-4 px-4">
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
                  organizationSlug={props.organizationSlug}
                  projectSlug={props.projectSlug}
                  targetSlug={props.targetSlug}
                  schemaCheckId=""
                  title="Breaking Changes"
                  criticality={CriticalityLevel.Breaking}
                  changes={schemaVersion.breakingSchemaChanges.nodes}
                />
              </div>
            )}
            {schemaVersion.safeSchemaChanges?.nodes?.length && (
              <div className="mb-2">
                <ChangesBlock
                  organizationSlug={props.organizationSlug}
                  projectSlug={props.projectSlug}
                  targetSlug={props.targetSlug}
                  schemaCheckId=""
                  title="Safe Changes"
                  criticality={CriticalityLevel.Safe}
                  changes={schemaVersion.safeSchemaChanges.nodes}
                />
              </div>
            )}
          </div>
        )}
        {selectedView === 'full-schema' && (
          <DiffEditor
            before={schemaVersion?.previousDiffableSchemaVersion?.sdl ?? null}
            after={schemaVersion?.sdl ?? null}
            downloadFileName="schema.graphql"
          />
        )}
        {selectedView === 'supergraph' && (
          <DiffEditor
            before={schemaVersion?.previousDiffableSchemaVersion?.supergraph ?? null}
            after={schemaVersion?.supergraph ?? null}
            downloadFileName="supergraph.graphqls"
          />
        )}
        {selectedView === 'service-schema' && (
          <DiffEditor
            before={schemaVersion?.log?.previousServiceSdl ?? null}
            after={('serviceSdl' in schemaVersion.log && schemaVersion.log.serviceSdl) || null}
            downloadFileName="service.graphql"
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
        ...ChangesBlock_SchemaChangeFragment
      }
    }
    safeSchemaChanges {
      nodes {
        ...ChangesBlock_SchemaChangeFragment
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
  projectType: ProjectType;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
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
  ];

  if (props.projectType === ProjectType.Federation) {
    availableViews.push({
      value: 'supergraph',
      icon: <DiffIcon className="h-5 w-auto flex-none" />,
      label: 'Supergraph',
      tooltip: 'Show diff of the supergraph',
      disabledReason: contractVersion?.schemaCompositionErrors
        ? 'Composition failed.'
        : contractVersion?.supergraphSDL
          ? null
          : 'No supergraph.',
    });
  }

  return (
    <>
      <TooltipProvider>
        <Tabs value={selectedView} onValueChange={value => setSelectedView(value)}>
          <TabsList className="bg-background border-muted w-full justify-start rounded-none border-x border-b">
            {availableViews.map(item => (
              <Tooltip key={item.value}>
                <TooltipTrigger>
                  <TabsTrigger value={item.value} disabled={!!item.disabledReason} asChild>
                    <span>
                      {item.icon}
                      <span className="ml-2">{item.label}</span>
                    </span>
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
      <div className="border-muted grow rounded-md rounded-t-none border border-t-0">
        {selectedView === 'details' && (
          <div className="my-4 px-4">
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
                  organizationSlug={props.organizationSlug}
                  projectSlug={props.projectSlug}
                  targetSlug={props.targetSlug}
                  schemaCheckId=""
                  title="Breaking Changes"
                  criticality={CriticalityLevel.Breaking}
                  changes={contractVersion.breakingSchemaChanges.nodes}
                />
              </div>
            )}
            {contractVersion.safeSchemaChanges?.nodes?.length && (
              <div className="mb-2">
                <ChangesBlock
                  organizationSlug={props.organizationSlug}
                  projectSlug={props.projectSlug}
                  targetSlug={props.targetSlug}
                  schemaCheckId=""
                  title="Safe Changes"
                  criticality={CriticalityLevel.Safe}
                  changes={contractVersion.safeSchemaChanges.nodes}
                />
              </div>
            )}
          </div>
        )}
        {selectedView === 'full-schema' && (
          <DiffEditor
            before={contractVersion?.previousDiffableContractVersion?.compositeSchemaSDL ?? null}
            after={contractVersion?.compositeSchemaSDL ?? null}
            downloadFileName="schema.graphqls"
          />
        )}
        {selectedView === 'supergraph' && (
          <DiffEditor
            before={contractVersion?.previousDiffableContractVersion?.supergraphSDL ?? null}
            after={contractVersion?.supergraphSDL ?? null}
            downloadFileName="supergraph.graphqls"
          />
        )}
      </div>
    </>
  );
}

const ActiveSchemaVersion_SchemaVersionQuery = graphql(`
  query ActiveSchemaVersion_SchemaVersionQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
    $versionId: ID!
  ) {
    target(
      selector: {
        organizationSlug: $organizationSlug
        projectSlug: $projectSlug
        targetSlug: $targetSlug
      }
    ) {
      id
      schemaVersion(id: $versionId) {
        id
        ...SchemaVersionView_SchemaVersionFragment
      }
    }
    project(selector: { organizationSlug: $organizationSlug, projectSlug: $projectSlug }) {
      id
      type
    }
  }
`);

function ActiveSchemaVersion(props: {
  versionId: string;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const [query] = useQuery({
    query: ActiveSchemaVersion_SchemaVersionQuery,
    variables: {
      organizationSlug: props.organizationSlug,
      projectSlug: props.projectSlug,
      targetSlug: props.targetSlug,
      versionId: props.versionId,
    },
  });

  const { error } = query;

  const isLoading = query.fetching || query.stale;
  const schemaVersion = query?.data?.target?.schemaVersion;
  const projectType = query?.data?.project?.type;

  if (isLoading || !schemaVersion || !projectType) {
    return (
      <div className="flex size-full flex-col items-center justify-center self-center text-sm text-gray-500">
        <Spinner className="mb-3 size-8" />
        Loading schema version...
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

  return schemaVersion ? (
    <SchemaVersionView
      organizationSlug={props.organizationSlug}
      projectSlug={props.projectSlug}
      targetSlug={props.targetSlug}
      schemaVersion={schemaVersion}
      projectType={projectType}
    />
  ) : null;
}

export function TargetHistoryVersionPage(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  versionId: string;
}) {
  return <ActiveSchemaVersion {...props} />;
}
