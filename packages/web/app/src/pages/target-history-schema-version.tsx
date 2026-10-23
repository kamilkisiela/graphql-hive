import { ReactElement, ReactNode, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowRightIcon,
  BoxIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  CircleIcon,
  Clock,
  DownloadIcon,
  ExternalLink,
  FileCode2,
  FileIcon,
  GitBranch,
  GitCommit,
  GitCompare,
  GitCompareArrows,
  GitCompareIcon,
  InfoIcon,
  Layers,
  ListIcon,
  ListTree,
  Minus,
  Plus,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useQuery } from 'urql';
import { ContractFailuresTable } from '@/components/target/checks/contract-failures-table';
import { changeSafetyStats } from '@/components/target/history/change-safety-stats';
import { CompositionErrorsCard } from '@/components/target/history/composition-errors-card';
import { ChangesBlock } from '@/components/target/history/errors-and-changes';
import { CodeScrollArea, File, FileDiff } from '@/components/ui/diffs';
import { Link } from '@/components/ui/link';
import { NotFound } from '@/components/ui/not-found/not-found';
import { Button } from '@/components/ui/primitives/button/button';
import { CopyChip } from '@/components/ui/primitives/copy-chip/copy-chip';
import { DescriptionList } from '@/components/ui/primitives/description-list/description-list';
import { Select } from '@/components/ui/primitives/floating/select/select';
import { Tooltip } from '@/components/ui/primitives/floating/tooltip/tooltip';
import { Spinner } from '@/components/ui/primitives/spinner/spinner';
import { StatusDot } from '@/components/ui/primitives/status-dot/status-dot';
import { QueryError } from '@/components/ui/query-error';
import { ScopeBar } from '@/components/ui/scope-bar/scope-bar';
import { useSdlDiff } from '@/components/ui/sdl-diff';
import { TabbedView } from '@/components/ui/tabbed-view/tabbed-view';
import { TimeAgo } from '@/components/ui/time-ago';
import { FragmentType, graphql, useFragment } from '@/gql';
import { SeverityLevelType } from '@/gql/graphql';
import { useSlugs } from '@/lib/hooks';
import { useResetState } from '@/lib/hooks/use-reset-state';
import { cn, formatCount } from '@/lib/utils';

/** A status icon inside a tab, explained on hover. */
function StatusTooltip(props: { icon: React.ReactNode; label: string }) {
  return (
    <Tooltip trigger={<span className="inline-flex">{props.icon}</span>} content={props.label} />
  );
}

export const TargetHistoryGraphVersion_ActiveGraphVersionQuery = graphql(`
  query TargetHistoryGraphVersion_ActiveGraphVersionQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
    $schemaVersionId: ID!
  ) {
    project(
      reference: { bySelector: { organizationSlug: $organizationSlug, projectSlug: $projectSlug } }
    ) {
      id
      type
      target: targetBySlug(targetSlug: $targetSlug) {
        id
        schemaVersion(id: $schemaVersionId) {
          id
          ...SchemaVersionView_SchemaVersionFragment
        }
      }
    }
  }
`);

export function TargetHistorySchemaVersionPage(props: { schemaVersionId: string }) {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [query] = useQuery({
    query: TargetHistoryGraphVersion_ActiveGraphVersionQuery,
    variables: {
      organizationSlug,
      projectSlug,
      targetSlug,
      schemaVersionId: props.schemaVersionId,
    },
  });

  const isLoading = query.fetching || query.stale;

  if (isLoading) {
    return (
      <div className="flex size-full flex-col items-center justify-center self-center text-sm text-fg-secondary">
        <span className="mb-3">
          <Spinner variants={{ size: 'lg' }} />
        </span>
        Loading schema version...
      </div>
    );
  }

  const schemaVersion = query.data?.project?.target?.schemaVersion ?? null;

  if (query.error) {
    return (
      <QueryError
        organizationSlug={organizationSlug}
        error={query.error}
        showError
        showLogoutButton={false}
        className="mt-20"
      />
    );
  }

  if (!schemaVersion) {
    return (
      <NotFound
        title="Schema Version not found."
        description="This schema version does not seem to exist anymore."
        showBackButton={false}
      />
    );
  }

  return <SchemaVersionView schemaVersion={schemaVersion} />;
}

const SchemaVersionView_SchemaVersionFragment = graphql(`
  fragment SchemaVersionView_SchemaVersionFragment on SchemaVersion {
    id
    date
    isComposable
    hasSchemaChanges
    isValid
    isFirstComposableVersion
    schemaCompositionErrors {
      ...CompositionErrorsSection_SchemaErrorConnection
    }
    supergraphSdl: supergraph
    supergraphChanges {
      edges {
        node {
          ...FilterableSchemaChangeBlock_ChangesFragment
        }
      }
    }
    sdl
    sdlChanges: schemaChanges {
      edges {
        node {
          ...FilterableSchemaChangeBlock_ChangesFragment
          severityLevel
        }
      }
    }
    previousDiffableVersion: previousDiffableSchemaVersion {
      id
      supergraphSdl: supergraph
      sdl
    }
    subgraphDiffs {
      ...SchemaVersionSubgraphView__SubgraphDiffFragment
    }
    ...SchemaVersionHeader_SchemaVersionFragment
    ...SchemaVersionSummary_SchemaVersionFragment
    contractVersions {
      edges {
        node {
          id
          contractName
          hasSchemaChanges
          isComposable
          isFirstComposableVersion
          supergraphSdl: supergraphSDL
          sdl: compositeSchemaSDL
          sdlChanges: schemaChanges {
            edges {
              node {
                ...FilterableSchemaChangeBlock_ChangesFragment
                severityLevel
              }
            }
          }
          schemaCompositionErrors {
            edges {
              node {
                message
              }
            }
            ...CompositionErrorsSection_SchemaErrorConnection
          }
          previousDiffableVersion: previousDiffableContractVersion {
            id
            supergraphSdl: supergraphSDL
            sdl: compositeSchemaSDL
          }
          ...SchemaVersionSummary_ContractVersionFragment
        }
      }
    }
  }
`);

type SchemaVersionViewProps = {
  schemaVersion: FragmentType<typeof SchemaVersionView_SchemaVersionFragment>;
};

function SchemaVersionView(props: SchemaVersionViewProps) {
  const schemaVersion = useFragment(SchemaVersionView_SchemaVersionFragment, props.schemaVersion);

  const [selectedItem, setSelectedItem] = useResetState<string>(
    () => 'default',
    [schemaVersion.id],
  );
  const contractVersionNode = useMemo(
    () =>
      schemaVersion.contractVersions?.edges?.find(edge => edge.node.id === selectedItem)?.node ??
      null,
    [selectedItem, schemaVersion],
  );
  const [selectedView, setSelectedView] = useResetState<string>(
    () => 'details',
    [!!schemaVersion.subgraphDiffs],
  );

  const contractOrVersion = useMemo(() => {
    if (contractVersionNode) {
      return {
        id: contractVersionNode.id,
        schemaCompositionErrors: contractVersionNode.schemaCompositionErrors,
        isFirstComposableVersion: contractVersionNode.isFirstComposableVersion,
        isComposable: contractVersionNode.isComposable,
        sdlChanges: contractVersionNode.sdlChanges,
        sdl: contractVersionNode.sdl,
        supergraphSdl: contractVersionNode.supergraphSdl,
        supergraphChanges: null,
        previousDiffableVersion: contractVersionNode.previousDiffableVersion,
      };
    }

    return {
      id: schemaVersion.id,
      schemaCompositionErrors: schemaVersion.schemaCompositionErrors,
      isFirstComposableVersion: schemaVersion.isFirstComposableVersion,
      isComposable: schemaVersion.isComposable,
      sdlChanges: schemaVersion.sdlChanges,
      sdl: schemaVersion.sdl,
      supergraphSdl: schemaVersion.supergraphSdl,
      supergraphChanges: schemaVersion.supergraphChanges,
      previousDiffableVersion: schemaVersion.previousDiffableVersion,
    };
  }, [schemaVersion, contractVersionNode]);

  const contractVersions = schemaVersion.contractVersions?.edges ?? [];
  // Without contracts there is nothing to pick, but the default graph keeps its status glyph.
  const contractPicker = !contractVersions.length ? (
    schemaVersion.contractVersions?.edges ? (
      <span className="inline-flex items-center gap-1.5 px-2 text-xs text-fg-default">
        {versionStatusIcon(schemaVersion, DEFAULT_GRAPH_LABELS)}
        Default Graph
      </span>
    ) : undefined
  ) : (
    <Select
      aria-label="Contract version"
      value={selectedItem}
      onValueChange={setSelectedItem}
      label={
        <span className="inline-flex items-center gap-1.5">
          {contractVersionNode
            ? versionStatus(contractVersionNode, CONTRACT_LABELS).icon
            : versionStatus(schemaVersion, DEFAULT_GRAPH_LABELS).icon}
          {contractVersionNode
            ? `${contractVersionNode.contractName}@${contractVersionNode.id.substring(0, 8)}`
            : 'Default Graph'}
        </span>
      }
      options={[
        {
          value: 'default',
          label: 'Default Graph',
          trailing: versionStatusTrailing(schemaVersion, DEFAULT_GRAPH_LABELS),
        },
        ...contractVersions.map(edge => ({
          value: edge.node.id,
          label: `${edge.node.contractName}@${edge.node.id.substring(0, 8)}`,
          trailing: versionStatusTrailing(edge.node, CONTRACT_LABELS),
        })),
      ]}
      size="compact"
      width="auto"
    />
  );

  // The picker opens on the default graph, so a contract version that failed is named here first.
  const failures = contractVersions.flatMap(edge =>
    edge.node.isComposable
      ? []
      : [
          {
            key: edge.node.id,
            label: `${edge.node.contractName}@${edge.node.id.substring(0, 8)}`,
            reason: 'Contract composition failed.',
            detail: formatCount(edge.node.schemaCompositionErrors?.edges.length ?? 0, 'error'),
            onView: () => setSelectedItem(edge.node.id),
          },
        ],
  );

  const summary =
    schemaVersion.subgraphDiffs === null && contractOrVersion.isFirstComposableVersion ? (
      <FirstComposableGraphVersion />
    ) : (
      <>
        {contractOrVersion.schemaCompositionErrors && (
          <CompositionErrorsCard compositionErrors={contractOrVersion.schemaCompositionErrors} />
        )}
        <SchemaVersionSummary schemaVersion={schemaVersion} contractVersion={contractVersionNode} />
        {!schemaVersion.subgraphDiffs && (
          <GraphQLSchemaView
            title="GraphQL Schema"
            subtitle="The GraphQL Schema used by GraphQL consumers."
            changes={contractOrVersion.sdlChanges?.edges.map(edge => edge.node) ?? null}
            currentSdl={contractOrVersion.sdl ?? ''}
            previousSdl={contractOrVersion.previousDiffableVersion?.sdl ?? null}
            fromName={
              contractOrVersion.previousDiffableVersion
                ? `schema@${contractOrVersion.previousDiffableVersion.id.substring(0, 8)}`
                : null
            }
            toName={`schema@${contractOrVersion.id.substring(0, 8)}`}
          />
        )}
      </>
    );

  const publicSchema = contractOrVersion.schemaCompositionErrors ? (
    <>
      <CompositionErrorsCard compositionErrors={contractOrVersion.schemaCompositionErrors} />
      <p>No schema available as the composition did not succeed.</p>
    </>
  ) : (
    <GraphQLSchemaView
      title="Public GraphQL Schema"
      subtitle="The GraphQL Schema used by GraphQL consumers."
      changes={contractOrVersion.sdlChanges?.edges.map(edge => edge.node) ?? null}
      currentSdl={contractOrVersion.sdl ?? ''}
      previousSdl={contractOrVersion.previousDiffableVersion?.sdl ?? null}
      fromName={
        contractOrVersion.previousDiffableVersion
          ? `schema@${contractOrVersion.previousDiffableVersion.id.substring(0, 8)}`
          : null
      }
      toName={`schema@${contractOrVersion.id.substring(0, 8)}`}
    />
  );

  const supergraph = contractOrVersion.schemaCompositionErrors ? (
    <>
      <CompositionErrorsCard compositionErrors={contractOrVersion.schemaCompositionErrors} />
      <p>No supergraph available as the composition did not succeed.</p>
    </>
  ) : (
    <GraphQLSchemaView
      title="Supergraph"
      subtitle="Learn how the supergraph consumed by the Federation Router is affected."
      changes={contractOrVersion.supergraphChanges?.edges.map(edge => edge.node) ?? null}
      currentSdl={contractOrVersion.supergraphSdl ?? ''}
      previousSdl={contractOrVersion.previousDiffableVersion?.supergraphSdl ?? null}
      fromName={
        contractOrVersion.previousDiffableVersion
          ? `supergraph@${contractOrVersion.previousDiffableVersion.id.substring(0, 8)}`
          : null
      }
      toName={`supergraph@${schemaVersion.id.substring(0, 8)}`}
    />
  );

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col py-6">
      <div className="mb-3">
        <SchemaVersionHeader schemaVersion={schemaVersion} />
      </div>
      {/* A monolithic schema has no subgraphs, so its summary sits on the page without tabs. */}
      {schemaVersion.subgraphDiffs ? (
        <div className="mt-3 flex flex-col gap-3">
          {failures.length ? (
            <div className="mb-3">
              <ContractFailuresTable
                title={`${failures.length} of ${contractVersions.length} contracts failed`}
                aside={`${contractVersions.length - failures.length} passed`}
                items={failures}
              />
            </div>
          ) : null}
          {contractPicker ? <ScopeBar picker={contractPicker} /> : null}
          <TabbedView
            value={selectedView}
            onValueChange={setSelectedView}
            items={[
              {
                value: 'details',
                label: 'Summary',
                icon: ListIcon,
                content: <div className="space-y-8">{summary}</div>,
              },
              {
                value: 'full-schema',
                label: 'Schema',
                icon: FileCode2,
                content: <div className="space-y-8">{publicSchema}</div>,
              },
              {
                value: 'supergraph',
                label: 'Supergraph',
                icon: Layers,
                content: <div className="space-y-8">{supergraph}</div>,
              },
              {
                value: 'service-schema',
                label: 'Subgraphs',
                icon: BoxIcon,
                content: (
                  <div className="space-y-8">
                    <GraphVersionSubgraphView subgraphDiffs={schemaVersion.subgraphDiffs} />
                  </div>
                ),
              },
            ]}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-8">{summary}</div>
      )}
    </div>
  );
}

type VersionStatusFlags = { hasSchemaChanges: boolean; isComposable: boolean };
type VersionStatusLabels = { changed: string; succeeded: string; failed: string };

/** The glyph and the words for a version's outcome; the trigger takes the glyph, the list both. */
function versionStatus(version: VersionStatusFlags, labels: VersionStatusLabels) {
  if (version.hasSchemaChanges) {
    return {
      icon: <GitCompareIcon className="size-3.5" />,
      label: labels.changed,
      state: 'Schema changed',
    };
  }
  if (version.isComposable) {
    return {
      icon: <CheckIcon className="size-3.5 text-success" />,
      label: labels.succeeded,
      state: 'No changes',
    };
  }
  return {
    icon: <TriangleAlertIcon className="size-3.5 text-critical" />,
    label: labels.failed,
    state: 'Failed',
  };
}

function versionStatusIcon(version: VersionStatusFlags, labels: VersionStatusLabels) {
  const status = versionStatus(version, labels);
  return <StatusTooltip icon={status.icon} label={status.label} />;
}

/** A picker row's status: glyph and state in words, the reason on hover. */
function versionStatusTrailing(version: VersionStatusFlags, labels: VersionStatusLabels) {
  const status = versionStatus(version, labels);
  return (
    <StatusTooltip
      icon={
        <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
          {status.icon}
          {status.state}
        </span>
      }
      label={status.label}
    />
  );
}

const DEFAULT_GRAPH_LABELS: VersionStatusLabels = {
  changed: 'Main graph schema changed',
  succeeded: 'Composition succeeded.',
  failed: 'Composition failed.',
};

const CONTRACT_LABELS: VersionStatusLabels = {
  changed: 'Contract schema changed',
  succeeded: 'Contract composition succeeded.',
  failed: 'Contract composition failed.',
};

function GraphQLSchemaView(props: {
  title: string;
  subtitle: string;
  changes: Array<FragmentType<typeof FilterableSchemaChangeBlock_ChangesFragment>> | null;
  currentSdl: string;
  previousSdl: string | null;
  fromName: string | null;
  toName: string;
}): ReactElement {
  const [viewMode, setViewMode] = useResetState<'changes' | 'diff' | 'raw'>(() => {
    if (!props.previousSdl) {
      return 'raw';
    }
    return 'changes';
  }, [props.previousSdl, props.currentSdl]);

  const titleNode = (
    <span className="flex items-center gap-1">
      {props.fromName && (
        <>
          {props.fromName}
          <ArrowRightIcon className="inline size-3" />
        </>
      )}
      {props.toName}
    </span>
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeader title={props.title} subtitle={props.subtitle} />
        {props.previousSdl && <ViewModeToggle active={viewMode} onChange={setViewMode} />}
      </div>
      {viewMode === 'changes' && (
        <FilterableSchemaChangeBlock
          title={titleNode}
          changes={props.changes}
          hasPreviousVersion={props.previousSdl !== null}
        />
      )}
      {viewMode === 'diff' && (
        <GenericGraphCard
          title={titleNode}
          actions={<span className="text-xs text-fg-muted">Sorted by kind and name</span>}
        >
          {/* Fills the viewport below the tab strip and the two headers (11rem), as SdlPane does. */}
          <div className="flex min-h-[var(--code-max-h)] flex-col [--code-max-h:calc(100vh-11rem)]">
            {(props.previousSdl ?? '') === props.currentSdl ? (
              <div className="px-5 py-3">
                <NoGraphChanges />
              </div>
            ) : (
              <SDLDiffView
                before={props.previousSdl ?? ''}
                after={props.currentSdl}
                sorted
                tooLargeMessage="Every change is listed under Changes. To browse the full schema, switch to View."
              />
            )}
          </div>
        </GenericGraphCard>
      )}
      {viewMode === 'raw' && props.currentSdl && (
        <GenericGraphCard
          title={<>{props.toName}</>}
          actions={
            <>
              <DownloadButton contents={props.currentSdl} fileName={props.toName + '.graphqls'} />
            </>
          }
        >
          <SDLView sdl={props.currentSdl} />
        </GenericGraphCard>
      )}
    </>
  );
}

function DownloadButton(props: { contents: string; fileName: string }) {
  return (
    <Tooltip
      trigger={
        <Button
          variant="ghost"
          size="compact"
          onClick={() => {
            const element = document.createElement('a');
            element.setAttribute(
              'href',
              'data:text/plain;charset=utf-8, ' + encodeURIComponent(props.contents),
            );
            element.setAttribute('download', props.fileName);
            document.body.appendChild(element);
            element.click();

            document.body.removeChild(element);
          }}
        >
          <DownloadIcon className="mr-1 size-3" /> Download
        </Button>
      }
      content={`Download ${props.fileName}`}
    />
  );
}

const FilterableSchemaChangeBlock_ChangesFragment = graphql(`
  fragment FilterableSchemaChangeBlock_ChangesFragment on SchemaChange {
    severityLevel
    ...ChangesBlock_SchemaChangeFragment
  }
`);

function FilterableSchemaChangeBlock(props: {
  title: ReactNode;
  changes: Array<FragmentType<typeof FilterableSchemaChangeBlock_ChangesFragment>> | null;
  hasPreviousVersion: boolean;
}) {
  const [selectedChangeType, setSelectedChangeType] = useState(null as SeverityLevelType | null);
  const changes = useFragment(FilterableSchemaChangeBlock_ChangesFragment, props.changes);

  const filteredChanges = useMemo(() => {
    if (selectedChangeType === null) {
      return changes;
    }

    return changes?.filter(change => change.severityLevel === selectedChangeType);
  }, [changes, selectedChangeType]);

  return (
    <div className="space-y-3">
      <ChangeTypeToggle selectedChangeType={selectedChangeType} onChange={setSelectedChangeType} />
      <GenericGraphCard title={props.title}>
        <div className="px-5">
          {filteredChanges?.length ? (
            <div className="pt-2 pb-8">
              <ChangesBlock explorerLinks="version" changes={filteredChanges} />
            </div>
          ) : selectedChangeType !== null ? (
            <div className="py-3 text-xs">No changes of this change type.</div>
          ) : props.hasPreviousVersion ? (
            <div className="py-3">
              <NoGraphChanges />
            </div>
          ) : (
            <div className="py-3 text-xs">This is the initial version! No changes available. </div>
          )}
        </div>
      </GenericGraphCard>
    </div>
  );
}

const SchemaVersionSubgraphView__SubgraphDiffFragment = graphql(`
  fragment SchemaVersionSubgraphView__SubgraphDiffFragment on SubgraphDiff {
    ...SubgraphRow_SubgraphDiffFragment
    ... on SubgraphDiffAdded {
      subgraphVersion {
        id
        sdl
        serviceName
      }
    }
    ... on SubgraphDiffChanged {
      subgraphVersion {
        id
        sdl
        serviceName
      }
      previousSubgraphVersion {
        id
        sdl
        serviceName
      }
      changes {
        edges {
          node {
            severityLevel
            ...ChangesBlock_SchemaChangeFragment
          }
        }
      }
    }
    ... on SubgraphDiffRemoved {
      removedSubgraphVersion {
        id
        sdl
        serviceName
      }
    }
    ... on SubgraphDiffUnchanged {
      subgraphVersion {
        id
        sdl
        serviceName
      }
    }
  }
`);

function SubgraphCard(props: {
  diff: FragmentType<typeof SubgraphRow_SubgraphDiffFragment>;
  renderChildren?: () => ReactNode;
  isInitiallyCollapsed?: boolean;
}) {
  const [isCollapsed, setIsCollapsed] = useState(props.isInitiallyCollapsed ?? false);
  return (
    <div className="divide-y overflow-hidden rounded-xl border">
      <SubgraphRow subgraphDiff={props.diff} className="bg-surface-card">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setIsCollapsed(isCollapsed => !isCollapsed)}
        >
          {isCollapsed && <ChevronUpIcon />}
          {!isCollapsed && <ChevronDownIcon />}
        </Button>
      </SubgraphRow>
      {props.renderChildren && !isCollapsed && (
        <div className="bg-surface-inset">{props.renderChildren()}</div>
      )}
    </div>
  );
}

function GraphVersionSubgraphView(props: {
  subgraphDiffs: Array<FragmentType<typeof SchemaVersionSubgraphView__SubgraphDiffFragment>>;
}) {
  const subgraphDiffs = useFragment(
    SchemaVersionSubgraphView__SubgraphDiffFragment,
    props.subgraphDiffs,
  );

  const [viewMode, setViewMode] = useState<'changes' | 'diff' | 'raw'>('changes');

  const Component = useMemo(
    () =>
      function Component(props: { children: ReactNode }) {
        return (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <SectionHeader
                title="Subgraphs"
                subtitle="Per-subgraph state and changes introduced by this version."
              />
              <ViewModeToggle active={viewMode} onChange={setViewMode} />
            </div>
            {props.children}
          </>
        );
      },
    [viewMode],
  );

  if (viewMode === 'changes') {
    return (
      <Component>
        <GraphVersionSubgraphChangesView subgraphDiffs={props.subgraphDiffs} />
      </Component>
    );
  }

  if (viewMode === 'diff') {
    return (
      <Component>
        {subgraphDiffs.map(diff => {
          if (diff.__typename === 'SubgraphDiffChanged') {
            return (
              <SubgraphCard
                key={diff.__typename + diff.subgraphVersion.id}
                diff={diff}
                renderChildren={
                  diff.previousSubgraphVersion.sdl === diff.subgraphVersion.sdl
                    ? () => (
                        <p className="max-w-[600px] p-5 text-xs">
                          The SDL did not change. This can happen if only the service url has
                          changed or the subgraph was manually published or force published to
                          multiple targets instead of being promoted.
                        </p>
                      )
                    : () => (
                        <SDLDiffView
                          before={diff.previousSubgraphVersion.sdl}
                          after={diff.subgraphVersion.sdl}
                        />
                      )
                }
              />
            );
          }

          if (diff.__typename === 'SubgraphDiffAdded') {
            return (
              <SubgraphCard
                key={diff.__typename + diff.subgraphVersion.id}
                diff={diff}
                renderChildren={() => <SDLDiffView before="" after={diff.subgraphVersion.sdl} />}
              />
            );
          }

          if (diff.__typename === 'SubgraphDiffUnchanged') {
            return (
              <SubgraphCard
                key={diff.__typename + diff.subgraphVersion.id}
                diff={diff}
                isInitiallyCollapsed
                renderChildren={() => <SDLView sdl={diff.subgraphVersion.sdl} />}
              />
            );
          }

          if (diff.__typename === 'SubgraphDiffRemoved') {
            return (
              <SubgraphCard
                key={diff.__typename + diff.removedSubgraphVersion.id}
                diff={diff}
                renderChildren={() => (
                  <SDLDiffView before={diff.removedSubgraphVersion.sdl} after="" />
                )}
              />
            );
          }

          return null;
        })}
      </Component>
    );
  }

  if (viewMode === 'raw') {
    return (
      <Component>
        {subgraphDiffs.map(diff => {
          if (diff.__typename === 'SubgraphDiffAdded') {
            return (
              <SubgraphCard
                key={diff.__typename + diff.subgraphVersion.id}
                diff={diff}
                renderChildren={() => <SDLView sdl={diff.subgraphVersion.sdl} />}
              />
            );
          }

          if (diff.__typename === 'SubgraphDiffChanged') {
            return (
              <SubgraphCard
                key={diff.__typename + diff.subgraphVersion.id}
                diff={diff}
                renderChildren={() => <SDLView sdl={diff.subgraphVersion.sdl} />}
              />
            );
          }

          if (diff.__typename === 'SubgraphDiffUnchanged') {
            return (
              <SubgraphCard
                key={diff.__typename + diff.subgraphVersion.id}
                diff={diff}
                renderChildren={() => <SDLView sdl={diff.subgraphVersion.sdl} />}
              />
            );
          }

          return null;
        })}
      </Component>
    );
  }

  viewMode satisfies never;
  return null;
}

function GraphVersionSubgraphChangesView(props: {
  subgraphDiffs: Array<FragmentType<typeof SchemaVersionSubgraphView__SubgraphDiffFragment>>;
}) {
  const [selectedChangeType, setSelectedChangeType] = useState(null as SeverityLevelType | null);
  const subgraphDiffs = useFragment(
    SchemaVersionSubgraphView__SubgraphDiffFragment,
    props.subgraphDiffs,
  );

  const nodes = useMemo(
    () =>
      subgraphDiffs.map(diff => {
        if (diff.__typename === 'SubgraphDiffChanged') {
          const edges =
            selectedChangeType === null
              ? diff.changes?.edges
              : diff.changes?.edges.filter(edge => edge.node.severityLevel === selectedChangeType);
          return (
            <SubgraphCard
              key={diff.__typename + diff.subgraphVersion.id}
              diff={diff}
              renderChildren={() => (
                <div className="px-5">
                  {edges?.length ? (
                    <div className="mb-8 pt-2">
                      <ChangesBlock
                        explorerLinks="version"
                        changes={edges?.map(edge => edge.node) ?? []}
                      />
                    </div>
                  ) : selectedChangeType === null ? (
                    <div className="py-5 text-xs">No changes available.</div>
                  ) : (
                    <div className="py-5 text-xs">No Changes available for this type.</div>
                  )}
                </div>
              )}
            />
          );
        }

        if (diff.__typename === 'SubgraphDiffRemoved') {
          return (
            <SubgraphCard
              key={diff.__typename + diff.removedSubgraphVersion.id}
              diff={diff}
              renderChildren={() => (
                <div className="px-5 py-5 text-xs">
                  Subgraph removed in this version. Its types are no longer part of the supergraph.
                </div>
              )}
            />
          );
        }

        if (diff.__typename === 'SubgraphDiffAdded') {
          return (
            <SubgraphCard
              key={diff.__typename + diff.subgraphVersion.id}
              diff={diff}
              renderChildren={() => (
                <div className="px-5 py-5 text-xs">
                  New subgraph introduced in this version. No prior schema to diff against.
                </div>
              )}
            />
          );
        }

        return null;
      }),
    [selectedChangeType, subgraphDiffs],
  );

  return (
    <div className="space-y-3">
      <ChangeTypeToggle selectedChangeType={selectedChangeType} onChange={setSelectedChangeType} />
      <div className="space-y-4">{nodes.some(node => node !== null) ? nodes : <>No Changes</>}</div>
    </div>
  );
}

export function SDLDiffView(props: {
  before: string;
  after: string;
  /** Compare sorted copies, for composed schemas whose definition order carries no meaning. */
  sorted?: boolean;
  /** What to read instead when the diff is too large to show: where the changes and the schema are. */
  tooLargeMessage?: ReactNode;
}) {
  const result = useSdlDiff(props.before, props.after, props.sorted ?? false);

  if (result === null) {
    return (
      <div className="flex items-center gap-2 px-5 py-3 text-xs text-fg-secondary">
        <Spinner variants={{ size: 'sm' }} label="Preparing diff" />
        Preparing diff…
      </div>
    );
  }

  switch (result.kind) {
    case 'unchanged':
      return <SDLView sdl={props.after} />;
    case 'order-only':
      return (
        <>
          <SDLDiffNotice
            icon={<CircleCheckIcon className="size-4 text-success" />}
            title="No changes apart from order"
          >
            Both schemas have the same definitions. Only their order or formatting differs.
          </SDLDiffNotice>
          <SDLView sdl={props.after} />
        </>
      );
    case 'too-large':
      return (
        <SDLDiffNotice
          icon={<InfoIcon className="size-4 text-fg-muted" />}
          title="Diff too large to display"
        >
          {props.tooLargeMessage ?? 'The schemas differ in too many lines to compare here.'}
        </SDLDiffNotice>
      );
    case 'diff':
      return (
        <CodeScrollArea>
          <FileDiff
            fileDiff={result.fileDiff}
            options={{
              disableFileHeader: true,
              diffStyle: 'unified',
            }}
          />
        </CodeScrollArea>
      );
  }
}

function SDLDiffNotice(props: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="cursor-default border-b border-line-subtle px-5 py-3">
      <div className="mb-1 flex items-center gap-3">
        {props.icon}
        <h2 className="text-sm font-medium text-fg">{props.title}</h2>
      </div>
      <p className="text-xs text-fg-secondary">{props.children}</p>
    </div>
  );
}

export function SDLView(props: { sdl: string }) {
  return (
    <CodeScrollArea>
      <div className="max-w-[inherit]">
        <File
          file={{
            name: 'schema.graphql',
            contents: props.sdl,
          }}
          options={{
            disableFileHeader: true,
          }}
        />
      </div>
    </CodeScrollArea>
  );
}

function FirstComposableGraphVersion() {
  return (
    <div className="cursor-default">
      <div className="mb-3 flex items-center gap-3">
        <CircleCheckIcon className="size-4 text-success" />
        <h2 className="text-base font-medium text-fg">First composable graph</h2>
      </div>
      <p className="text-xs text-fg-secondary">
        Congratulations! This is the first version of the graph that is composable.
      </p>
    </div>
  );
}

function NoGraphChanges() {
  return (
    <div className="cursor-default">
      <div className="mb-3 flex items-center gap-3">
        <CircleCheckIcon className="size-4 text-success" />
        <h2 className="text-base font-medium text-fg">No Graph Changes</h2>
      </div>
      <p className="text-xs text-fg-secondary">There are no public facing changes in the graph.</p>
    </div>
  );
}

const SchemaVersionHeader_SchemaVersionFragment = graphql(`
  fragment SchemaVersionHeader_SchemaVersionFragment on SchemaVersion {
    id
    isValid
    origin {
      ... on SchemaVersionPublishOrigin {
        revision
        publishedSubgraphs {
          name
          versionId
          revision
        }
      }
      ... on SchemaVersionPromoteOrigin {
        ...SchemaVersionPromotionOriginContents_SchemaVersionPromoteOriginFragment
      }
      ... on SchemaVersionSubgraphRemoveOrigin {
        removedSubgraphs {
          name
          versionId
        }
      }
    }
    date
    meta {
      author
      commit
    }
    githubMetadata {
      commit
      repository
    }
  }
`);

const SchemaVersionPromotionOriginContents_SchemaVersionPromoteOriginFragment = graphql(`
  fragment SchemaVersionPromotionOriginContents_SchemaVersionPromoteOriginFragment on SchemaVersionPromoteOrigin {
    schemaVersionId
    targetId
    targetSlug
  }
`);

function SchemaVersionPromotionOriginContents(props: {
  origin: FragmentType<
    typeof SchemaVersionPromotionOriginContents_SchemaVersionPromoteOriginFragment
  >;
}) {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const origin = useFragment(
    SchemaVersionPromotionOriginContents_SchemaVersionPromoteOriginFragment,
    props.origin,
  );
  const displayName = (
    <>
      {origin.targetSlug}@{origin.schemaVersionId.substring(0, 8)}
    </>
  );

  return (
    <>
      <span className="inline-flex items-center gap-1.5">
        <GitCommit className="h-3.5 w-3.5" />
        {origin.targetSlug === targetSlug ? (
          <Link
            className="font-mono"
            to="/$organizationSlug/$projectSlug/$targetSlug/history/$versionId"
            params={{
              organizationSlug,
              projectSlug,
              targetSlug: origin.targetSlug,
              versionId: origin.schemaVersionId,
            }}
          >
            {origin.targetSlug}@{origin.schemaVersionId.substring(0, 8)}
          </Link>
        ) : (
          <span>{displayName}</span>
        )}
      </span>
      <div>via Graph Version Promotion</div>
    </>
  );
}

function SchemaVersionHeader(props: {
  schemaVersion: FragmentType<typeof SchemaVersionHeader_SchemaVersionFragment>;
}) {
  const schemaVersion = useFragment(SchemaVersionHeader_SchemaVersionFragment, props.schemaVersion);

  const origin = (
    <>
      {schemaVersion.origin.__typename === 'SchemaVersionPromoteOrigin' && (
        <SchemaVersionPromotionOriginContents origin={schemaVersion.origin} />
      )}
      {schemaVersion.origin.__typename === 'SchemaVersionPublishOrigin' && (
        <>
          {schemaVersion.origin.publishedSubgraphs?.map(subgraph => (
            <span
              className="inline-flex items-center gap-1.5"
              key={subgraph.name + '|' + subgraph.versionId}
            >
              <GitCommit className="h-3.5 w-3.5" />
              <CopyChip
                value={subgraph.versionId}
                label={`${subgraph.name}@${subgraph.revision ?? subgraph.versionId.substring(0, 8)}`}
              />
            </span>
          ))}
          <div>
            {schemaVersion.origin.publishedSubgraphs?.length ? (
              <>via Subgraph Publish</>
            ) : (
              <>Schema Publish</>
            )}
          </div>
        </>
      )}
      {schemaVersion.origin.__typename === 'SchemaVersionSubgraphRemoveOrigin' && (
        <>
          {schemaVersion.origin.removedSubgraphs.map(subgraph => (
            <span
              className="inline-flex items-center gap-1.5"
              key={subgraph.name + '|' + subgraph.versionId}
            >
              <GitCommit className="h-3.5 w-3.5" />
              <CopyChip
                value={subgraph.versionId}
                label={`${subgraph.name}@${subgraph.versionId.substring(0, 8)}`}
              />
            </span>
          ))}
          <div>via Subgraph Delete</div>
        </>
      )}
    </>
  );

  const sourceControl = schemaVersion.githubMetadata ? (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <GitCommit className="h-3.5 w-3.5" />
      <CopyChip
        value={schemaVersion.githubMetadata.commit}
        label={schemaVersion.githubMetadata.commit.slice(0, 7)}
      />
      <span className="ml-1 inline-flex items-center gap-1">
        <GitBranch className="h-3 w-3" />
        {schemaVersion.githubMetadata.repository}
      </span>
    </span>
  ) : schemaVersion.meta?.commit ? (
    <span className="inline-flex items-center gap-1.5">
      <GitCommit className="h-3.5 w-3.5" />
      <CopyChip value={schemaVersion.meta.commit} label={schemaVersion.meta.commit.slice(0, 7)} />
    </span>
  ) : null;

  return (
    <header>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <h1 className="text-xl leading-tight font-semibold text-fg">Graph Version</h1>
        <CopyChip
          value={schemaVersion.id}
          label={
            schemaVersion.origin.__typename === 'SchemaVersionPublishOrigin' &&
            schemaVersion.origin.revision
              ? schemaVersion.origin.revision
              : schemaVersion.id.slice(0, 8)
          }
        />
      </div>
      <p className="mt-1.5 text-sm text-fg-secondary">
        Detailed view of the graph version changes.
      </p>
      <div className="mt-6 rounded-md border bg-surface-card px-5 py-4">
        <DescriptionList
          variants={{ termStyle: 'title', columns: 'auto' }}
          rows={[
            {
              items: [
                {
                  term: 'Status',
                  description: (
                    <span className="inline-flex items-center gap-1.5">
                      <StatusDot color={schemaVersion.isValid ? 'success' : 'critical'} />
                      {schemaVersion.isValid ? 'Composable' : 'Failed'}
                    </span>
                  ),
                },
                { term: 'Origin', description: origin },
                ...(sourceControl ? [{ term: 'Source Control', description: sourceControl }] : []),
                {
                  term: 'Created at',
                  description: (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3" />
                        <TimeAgo date={schemaVersion.date} />
                      </span>
                      {schemaVersion.meta?.author && (
                        <span className="mt-0.5 block truncate">
                          by {schemaVersion.meta.author}
                        </span>
                      )}
                    </>
                  ),
                },
              ],
            },
          ]}
        />
      </div>
    </header>
  );
}

type SchemaViewMode = 'changes' | 'diff' | 'raw';

const schemaViewModes: { id: SchemaViewMode; label: string; Icon: typeof ListTree }[] = [
  { id: 'changes', label: 'Changes', Icon: ListTree },
  { id: 'diff', label: 'Diff', Icon: GitCompare },
  { id: 'raw', label: 'View', Icon: FileIcon },
];

function ViewModeToggle(props: { active: SchemaViewMode; onChange: (m: SchemaViewMode) => void }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border p-1">
      {schemaViewModes.map(m => {
        const isActive = m.id === props.active;
        const Icon = m.Icon;
        return (
          <button
            key={m.id}
            onClick={() => props.onChange(m.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] transition-colors hover:bg-surface-hover',
              isActive ? 'bg-surface-selected' : 'hover:',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

const breakingChangeTypeModes: { id: SeverityLevelType; label: string; dotColor: string }[] = [
  { id: SeverityLevelType.Breaking, label: 'Breaking', dotColor: 'bg-critical' },
  { id: SeverityLevelType.Dangerous, label: 'Dangerous', dotColor: 'bg-warning' },
  { id: SeverityLevelType.Safe, label: 'Safe', dotColor: 'bg-info' },
];

function ChangeTypeToggle(props: {
  selectedChangeType: SeverityLevelType | null;
  onChange: (selectedChangeType: SeverityLevelType | null) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border p-1">
      <button
        onClick={() => props.onChange(null)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs hover:bg-surface-hover',
          props.selectedChangeType === null ? 'bg-surface-selected' : 'hover:',
        )}
      >
        <span className={cn('h-1.5 w-1.5 translate-y-[-1px] rounded-full', 'bg-fg-muted')} />
        All
      </button>
      {breakingChangeTypeModes.map(m => {
        const isActive = m.id === props.selectedChangeType;
        return (
          <button
            key={m.id}
            onClick={() => props.onChange(m.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs hover:bg-surface-hover',
              isActive ? 'bg-surface-selected' : 'hover:',
            )}
          >
            <span className={cn('h-1.5 w-1.5 translate-y-[-1px] rounded-full', m.dotColor)} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

const SchemaVersionSummary_SchemaVersionFragment = graphql(`
  fragment SchemaVersionSummary_SchemaVersionFragment on SchemaVersion {
    id
    isComposable
    subgraphDiffs {
      ...SubgraphRow_SubgraphDiffFragment
      ... on SubgraphDiffAdded {
        subgraphVersion {
          serviceName
          id
          url
        }
      }
      ... on SubgraphDiffRemoved {
        removedSubgraphVersion {
          serviceName
          id
          url
        }
      }
      ... on SubgraphDiffChanged {
        subgraphVersion {
          serviceName
          id
          url
        }
        previousSubgraphVersion {
          id
        }
        changes {
          edges {
            __typename
          }
        }
      }
      ... on SubgraphDiffUnchanged {
        subgraphVersion {
          id
          serviceName
          url
        }
      }
    }
    sdlChanges: schemaChanges {
      edges {
        node {
          isSafeBasedOnUsage
          severityLevel
          isUsageTracked
        }
      }
    }
  }
`);

const SchemaVersionSummary_ContractVersionFragment = graphql(`
  fragment SchemaVersionSummary_ContractVersionFragment on ContractVersion {
    id
    sdlChanges: schemaChanges {
      edges {
        node {
          isSafeBasedOnUsage
          severityLevel
          isUsageTracked
        }
      }
    }
  }
`);

function SectionHeader(props: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-fg">{props.title}</h2>
      <p className="mt-0.5 text-sm text-fg-secondary">{props.subtitle}</p>
    </div>
  );
}

export const SchemaVersionSummary = (props: {
  schemaVersion: FragmentType<typeof SchemaVersionSummary_SchemaVersionFragment>;
  contractVersion: null | FragmentType<typeof SchemaVersionSummary_ContractVersionFragment>;
}) => {
  const schemaVersion = useFragment(
    SchemaVersionSummary_SchemaVersionFragment,
    props.schemaVersion,
  );
  const contractVersion = useFragment(
    SchemaVersionSummary_ContractVersionFragment,
    props.contractVersion,
  );

  const subgraphStats = useMemo(() => {
    const data = {
      total: 0,
      added: 0,
      removed: 0,
      updated: 0,
    };

    for (const diff of schemaVersion.subgraphDiffs ?? []) {
      if (diff.__typename === 'SubgraphDiffAdded') {
        data.total++;
        data.added++;
      }
      if (diff.__typename === 'SubgraphDiffChanged') {
        data.total++;
        data.updated++;
      }
      if (diff.__typename === 'SubgraphDiffRemoved') {
        data.removed++;
      }
      if (diff.__typename === 'SubgraphDiffUnchanged') {
        data.total++;
      }
    }

    return data;
  }, [schemaVersion.subgraphDiffs]);

  const publicChangeStats = useMemo(
    () =>
      changeSafetyStats(
        (contractVersion ?? schemaVersion).sdlChanges?.edges.map(edge => edge.node) ?? [],
      ),
    [schemaVersion.sdlChanges, contractVersion?.sdlChanges],
  );

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader title="Summary" subtitle="Changes introduced by this version." />
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-surface-card 2xl:grid-cols-6">
        <Stat label="Schema changes" value={publicChangeStats.totalChanges} />
        <Stat
          label="Breaking changes"
          value={publicChangeStats.breakingChanges}
          additionalValue={
            publicChangeStats.breakingChanges && schemaVersion.isComposable ? (
              publicChangeStats.notSafe ? (
                <Tooltip
                  trigger={
                    <span className="ml-2 flex items-center gap-0.5 text-xs text-critical lg:text-sm">
                      <ShieldAlertIcon size="14" className="inline" />
                      {publicChangeStats.notSafe} not safe
                    </span>
                  }
                  content="Some changes are in use, or usage isn't recorded for what they touch."
                />
              ) : (
                <Tooltip
                  trigger={
                    <span className="pl-2 text-base text-success">
                      <CheckIcon size="14" className="inline" /> All safe
                    </span>
                  }
                  content="All these changes are safe based on usage reporting data."
                />
              )
            ) : null
          }
        />
        <Stat label="Total Subgraphs" value={subgraphStats.total} />
        <Stat label="Added subgraphs" value={subgraphStats.added} className="hidden 2xl:flex" />
        <Stat
          label="Removed Subgraphs "
          value={subgraphStats.removed}
          className="hidden 2xl:flex"
        />
        <Stat
          label="Updated Subgraphs "
          value={subgraphStats.updated}
          className="hidden 2xl:flex"
        />
      </div>

      {schemaVersion.subgraphDiffs && (
        <div className="overflow-hidden rounded-xl border">
          <div className="flex items-center justify-between border-b bg-surface-card px-5 py-3">
            <div className="flex items-center gap-2 text-xs font-bold capitalize">
              Subgraph Overview
            </div>
          </div>
          <ul className="divide-y bg-surface-inset">
            {schemaVersion.subgraphDiffs
              .sort(diff => (diff.__typename === 'SubgraphDiffUnchanged' ? 1 : -1))
              .map((diff, index) => (
                <li
                  className={cn(diff.__typename === 'SubgraphDiffUnchanged' && 'opacity-50')}
                  key={`${schemaVersion.id}_${index}`}
                >
                  <SubgraphRow subgraphDiff={diff} />
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const Stat = (props: {
  label: string;
  value: number;
  additionalValue?: ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn('flex flex-col gap-1.5 px-5 py-4', props.className)}>
      <span className="text-xs font-bold capitalize">{props.label}</span>
      <span>
        <span className="text-xl leading-none tracking-tight">
          {props.value === 0 ? '-' : props.value}
        </span>
        {props.additionalValue && <> {props.additionalValue}</>}
      </span>
    </div>
  );
};

const kindMeta = {
  SubgraphDiffAdded: {
    label: 'Added',
    Icon: Plus,
    text: 'text-warning',
    bg: 'bg-warning-tint-strong',
    ring: 'ring-warning-line',
    dot: 'bg-warning',
  },
  SubgraphDiffRemoved: {
    label: 'Removed',
    Icon: Minus,
    text: 'text-critical',
    bg: 'bg-critical-tint-strong',
    ring: 'ring-critical-line',
    dot: 'bg-critical',
  },
  SubgraphDiffChanged: {
    label: 'Updated',
    Icon: GitCompareArrows,
    text: 'text-info',
    bg: 'bg-info-tint-strong',
    ring: 'ring-info-line',
    dot: 'bg-info',
  },
  SubgraphDiffUnchanged: {
    label: 'Unchanged',
    Icon: CircleIcon,
    text: 'text-fg-secondary',
    bg: 'bg-surface-page',
    ring: 'ring-line-strong',
    dot: 'bg-line',
  },
} as const;

const SubgraphRow_SubgraphDiffFragment = graphql(`
  fragment SubgraphRow_SubgraphDiffFragment on SubgraphDiff {
    ... on SubgraphDiffAdded {
      subgraphVersion {
        serviceName
        id
        revision
        url
      }
    }
    ... on SubgraphDiffRemoved {
      removedSubgraphVersion {
        serviceName
        id
        revision
        url
      }
    }
    ... on SubgraphDiffChanged {
      subgraphVersion {
        serviceName
        id
        revision
        url
      }
      previousSubgraphVersion {
        id
        revision
      }
      changes {
        edges {
          __typename
        }
      }
    }
    ... on SubgraphDiffUnchanged {
      subgraphVersion {
        id
        revision
        serviceName
        url
      }
    }
  }
`);

function SubgraphRow(props: {
  subgraphDiff: FragmentType<typeof SubgraphRow_SubgraphDiffFragment>;
  children?: ReactNode;
  className?: string;
}) {
  const subgraphDiff = useFragment(SubgraphRow_SubgraphDiffFragment, props.subgraphDiff);

  const meta = kindMeta[subgraphDiff.__typename];
  const Icon = meta.Icon;

  return (
    <div className={cn('flex items-center gap-4 px-5 py-3.5', props.className)}>
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1',
          meta.bg,
          meta.ring,
        )}
      >
        <Icon className={cn('h-3.5 w-3.5', meta.text)} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-x-1">
          {subgraphDiff.__typename === 'SubgraphDiffUnchanged' && (
            <code className="py-0.5 text-sm">
              {subgraphDiff.subgraphVersion.serviceName}@
              {subgraphDiff.subgraphVersion.revision ??
                subgraphDiff.subgraphVersion.id.substring(0, 8)}
            </code>
          )}
          {subgraphDiff.__typename === 'SubgraphDiffAdded' && (
            <code className="py-0.5 text-sm">
              {subgraphDiff.subgraphVersion.serviceName}@
              {subgraphDiff.subgraphVersion.revision ??
                subgraphDiff.subgraphVersion.id.substring(0, 8)}
            </code>
          )}
          {subgraphDiff.__typename === 'SubgraphDiffChanged' && (
            <>
              <code className="py-0.5 text-sm">
                {subgraphDiff.subgraphVersion.serviceName}@
                {subgraphDiff.previousSubgraphVersion.revision ??
                  subgraphDiff.previousSubgraphVersion.id.substring(0, 8)}
              </code>
              <ArrowRight className="h-3 w-3" />
              <code className="py-0.5 text-sm">
                {subgraphDiff.subgraphVersion.serviceName}@
                {subgraphDiff.subgraphVersion.revision ??
                  subgraphDiff.subgraphVersion.id.substring(0, 8)}
              </code>
            </>
          )}
          {subgraphDiff.__typename === 'SubgraphDiffRemoved' && (
            <code className="py-0.5 text-sm">
              {subgraphDiff.removedSubgraphVersion.serviceName}@
              {subgraphDiff.removedSubgraphVersion.revision ??
                subgraphDiff.removedSubgraphVersion.id.substring(0, 8)}
            </code>
          )}
        </div>
        {subgraphDiff.__typename === 'SubgraphDiffUnchanged' && (
          <SubgraphLink url={subgraphDiff.subgraphVersion.url} />
        )}
        {subgraphDiff.__typename === 'SubgraphDiffAdded' && (
          <SubgraphLink url={subgraphDiff.subgraphVersion.url} />
        )}
        {subgraphDiff.__typename === 'SubgraphDiffChanged' && (
          <SubgraphLink url={subgraphDiff.subgraphVersion.url} />
        )}
        {subgraphDiff.__typename === 'SubgraphDiffRemoved' && (
          <SubgraphLink url={subgraphDiff.removedSubgraphVersion.url} />
        )}
      </div>

      <span className={cn('inline-flex items-center gap-1.5 text-xs', meta.text)}>
        {subgraphDiff.__typename === 'SubgraphDiffChanged' && subgraphDiff.changes && (
          <span className="mr-2">
            {subgraphDiff.changes.edges.length} change
            {subgraphDiff.changes.edges.length === 1 ? null : 's'}
          </span>
        )}
        <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
        <span className="font-medium">{meta.label}</span>
        {props.children}
      </span>
    </div>
  );
}

function SubgraphLink(props: { url: string }) {
  return (
    <a
      href={props.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex w-fit items-center gap-1 text-xs text-fg-default"
    >
      {props.url}
      <ExternalLink className="h-2.5 w-2.5" />
    </a>
  );
}

function GenericGraphCard(props: { title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="divide-y overflow-hidden rounded-xl border">
      <div className="flex items-center gap-4 bg-surface-card px-5 py-3.5">
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1',
            'bg-surface-page',
            'ring-line-strong',
          )}
        >
          <BoxIcon className={cn('h-3.5 w-3.5')} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
            <code className="py-0.5 text-sm">{props.title}</code>
          </div>
        </div>
        {props.actions ? <>{props.actions}</> : null}
      </div>
      {props.children && <div className="bg-surface-inset">{props.children}</div>}
    </div>
  );
}
