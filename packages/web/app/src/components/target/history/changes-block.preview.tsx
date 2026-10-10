import { useState } from 'react';
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  FileDiffIcon,
  GitCompareIcon,
  ListIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { DataTable } from '@/components/ui/data-table/data-table';
import { DataTableCell } from '@/components/ui/data-table/data-table-cell';
import { Accordion } from '@/components/ui/primitives/accordion/accordion';
import { ContractFailuresTable } from '@/components/target/checks/contract-failures-table';
import { Subtitle, Title } from '@/components/ui/page';
import { Badge } from '@/components/ui/primitives/badge/badge';
import { Button } from '@/components/ui/primitives/button/button';
import { DescriptionList } from '@/components/ui/primitives/description-list/description-list';
import { Menu } from '@/components/ui/primitives/floating/menu/menu';
import { Select } from '@/components/ui/primitives/floating/select/select';
import { ScopeBar } from '@/components/ui/scope-bar/scope-bar';
import { TabbedView } from '@/components/ui/tabbed-view/tabbed-view';
import { makeFragmentData } from '@/gql';
import { SeverityLevelType } from '@/gql/graphql';
import { useSlugs } from '@/lib/hooks';
import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { RouterAt } from '../../../../foundry.router';
import {
  ChangesBlock,
  ChangesBlock_SchemaChangeWithUsageFragment,
  ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment,
  labelize,
} from './errors-and-changes';

export const nav: NavPath = 'Components/ChangesBlock';


const PATH = '/the-guild/graphql-hive/staging';
const PERIOD = { from: '2026-10-01T10:00:00.000Z', to: '2026-10-08T10:00:00.000Z' };

type PreviewTarget = { id: string; slug: string; target: { id: string; slug: string } | null };

const TARGET_SLUGS = [
  'production-eu',
  'production-us',
  'staging',
  'app-web',
  'app-ios',
  'app-android',
  'partner-api',
  'internal-tools',
  'sandbox',
  'canary',
  'legacy',
];

const TARGETS: PreviewTarget[] = TARGET_SLUGS.map((slug, index) => ({
  id: `target-${index + 1}`,
  slug,
  target: { id: `target-${index + 1}`, slug },
}));

const CLIENTS = [{ name: 'webapp', countFormatted: '255.2M', percentageFormatted: '44.06%' }];

const CHANGES = [
  { type: 'FunnelMetrics_ClosedWon', operation: 'FunnelMetricsClosedWon', hash: 'a0ec' },
  { type: 'FunnelMetrics_Created', operation: 'FunnelMetricsCreated', hash: 'bdd1' },
  { type: 'ProspectsContacted', operation: 'ProspectsContacted', hash: 'fb2a' },
  { type: 'ProspectsContactedActivity', operation: 'ProspectsContactedActivity', hash: '49ce' },
];

const hashOf = (prefix: string, index: number) => `${prefix}${index}`.padEnd(40, prefix);

const metadata = (targets: PreviewTarget[]) =>
  makeFragmentData(
    {
      __typename: 'SchemaCheckConditionalBreakingChangeMetadata' as const,
      period: { __typename: 'DateRange' as const, ...PERIOD },
      settings: {
        __typename: 'SchemaCheckConditionalBreakingChangeMetadataSettings' as const,
        retentionInDays: 7,
        targets: targets.map(target => ({
          __typename: 'BreakingChangeMetadataTarget' as const,
          id: target.id,
          slug: target.slug,
          target: target.target ? { __typename: 'Target' as const, ...target.target } : null,
        })),
      },
    },
    ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment,
  );

const todayChanges = CHANGES.map(change =>
  makeFragmentData(
    {
      __typename: 'SchemaChange' as const,
      path: [change.type],
      message: `Type '${change.type}' was removed`,
      severityLevel: SeverityLevelType.Breaking,
      severityReason:
        'Removing a type is a breaking change. It is preferable to deprecate and remove all references to this type first.',
      isSafeBasedOnUsage: false,
      approval: null,
      usageStatistics: {
        __typename: 'SchemaChangeUsageStatistics' as const,
        topAffectedOperations: [
          {
            __typename: 'SchemaChangeUsageStatisticsAffectedOperation' as const,
            hash: hashOf(change.hash, 0),
            name: change.operation,
            countFormatted: '1',
            percentageFormatted: '<0.01%',
          },
        ],
        topAffectedClients: CLIENTS.map(client => ({
          __typename: 'SchemaChangeUsageStatisticsAffectedClient' as const,
          ...client,
        })),
      },
      affectedAppDeployments: null,
    },
    ChangesBlock_SchemaChangeWithUsageFragment,
  ),
);

function TodayView() {
  return (
    <RouterAt path={PATH}>
      <div className="w-[72rem]">
        <ChangesBlock
          schemaCheckId="check-1"
          title="Breaking Changes"
          changesWithUsage={todayChanges}
          conditionBreakingChangeMetadata={metadata(TARGETS)}
        />
      </div>
    </RouterAt>
  );
}

export const Today = createPreview(() => <TodayView />);


type AffectedTarget = { target: PreviewTarget; count: number; countFormatted: string };

type ProposedOperation = {
  hash: string;
  name: string;
  countFormatted: string;
  percentageFormatted: string;
  affectedTargets: AffectedTarget[] | null;
};

type ProposedChange = {
  message: string;
  path: string[];
  topAffectedOperations: ProposedOperation[];
  topAffectedClients: typeof CLIENTS;
  affectedTargets: AffectedTarget[] | null;
};


const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Later operations reach fewer targets, so their "Seen in" differs from the change's.
function buildProposed(args: {
  used: number;
  unused: number;
  operations: number;
  legacy: boolean;
}): { targets: PreviewTarget[]; changes: ProposedChange[] } {
  const targets = TARGETS.slice(0, args.used + args.unused);
  const used = targets.slice(0, args.used);
  const spread = (index: number) =>
    index === 0 ? used : index === 1 ? used.slice(0, 1) : used.slice(-1);

  const changes = CHANGES.map(change => {
    const operations = Array.from({ length: args.operations }, (_, index) => ({
      targets: spread(index),
      name: index === 0 ? change.operation : `${change.operation}${index + 1}`,
      hash: hashOf(change.hash, index),
    }));
    const countFor = (target: PreviewTarget) =>
      operations.filter(operation => operation.targets.includes(target)).length;
    const affected = (list: PreviewTarget[]): AffectedTarget[] =>
      list.map(target => ({
        target,
        count: countFor(target),
        countFormatted: String(countFor(target)),
      }));
    const total = operations.reduce((sum, operation) => sum + operation.targets.length, 0);

    return {
      message: `Type '${change.type}' was removed`,
      path: [change.type],
      topAffectedOperations: operations.map(operation => ({
        hash: operation.hash,
        name: operation.name,
        countFormatted: String(operation.targets.length),
        percentageFormatted: '<0.01%',
        affectedTargets: args.legacy
          ? null
          : operation.targets.map(target => ({ target, count: 1, countFormatted: '1' })),
      })),
      topAffectedClients: CLIENTS.map(client => ({ ...client, countFormatted: String(total) })),
      affectedTargets: args.legacy ? null : affected(used),
    };
  });

  return { targets, changes };
}

const coordinateLink = (slugs: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  coordinate: string;
}) => ({
  to: '/$organizationSlug/$projectSlug/$targetSlug/insights/schema-coordinate/$coordinate' as const,
  params: slugs,
  search: { from: PERIOD.from, to: PERIOD.to },
});


function trafficColumns<
  TRow extends { countFormatted: string; percentageFormatted: string },
>(): ColumnDef<TRow, unknown>[] {
  return [
    {
      id: 'count',
      header: 'Total Requests',
      meta: { align: 'right', width: 'sm' },
      cell: ({ row }) => <DataTableCell kind="number" value={row.original.countFormatted} />,
    },
    {
      id: 'share',
      header: '% of traffic',
      meta: { align: 'right', width: 'sm' },
      cell: ({ row }) => <DataTableCell kind="number" value={row.original.percentageFormatted} />,
    },
  ];
}


const unusedOf = (change: ProposedChange, targets: PreviewTarget[]) => {
  const used = new Set((change.affectedTargets ?? []).map(affected => affected.target.id));
  return targets.filter(target => !used.has(target.id));
};


function OperationsAndClients(props: { change: ProposedChange }) {
  const operationColumns: ColumnDef<ProposedOperation, unknown>[] = [
    {
      id: 'name',
      header: 'Operation',
      meta: { width: 'fill' },
      cell: ({ row }) => (
        <DataTableCell
          kind="text"
          value={`${row.original.hash.substring(0, 4)}_${row.original.name}`}
          mono
        />
      ),
    },
    {
      id: 'seenIn',
      header: 'Seen in',
      meta: { width: 'md' },
      cell: ({ row }) => (
        <DataTableCell
          kind="text"
          tone="muted"
          value={(row.original.affectedTargets ?? []).map(a => a.target.slug).join(', ')}
        />
      ),
    },
    ...trafficColumns<ProposedOperation>(),
  ];
  const clientColumns: ColumnDef<(typeof CLIENTS)[number], unknown>[] = [
    {
      id: 'name',
      header: 'Client',
      meta: { width: 'fill' },
      cell: ({ row }) => <DataTableCell kind="text" value={row.original.name} weight="medium" />,
    },
    ...trafficColumns<(typeof CLIENTS)[number]>(),
  ];
  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-[3]">
        <DataTable
          data={props.change.topAffectedOperations}
          columns={operationColumns}
          getRowId={operation => operation.hash}
          pagination={{ kind: 'none' }}
        />
      </div>
      <div className="min-w-0 flex-[2]">
        <DataTable
          data={props.change.topAffectedClients}
          columns={clientColumns}
          getRowId={client => client.name}
          pagination={{ kind: 'none' }}
        />
      </div>
    </div>
  );
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

type TargetUsageRow = { target: PreviewTarget; operations: number; count: number };

type UsageStyle = { mono: boolean; tone: 'outline' | 'critical' };

function TargetsUsageTable(props: {
  title: string;
  unused: PreviewTarget[];
  rows: TargetUsageRow[];
  coordinate: string;
  usage: UsageStyle;
}) {
  const { organizationSlug, projectSlug } = useSlugs('target');
  const columns: ColumnDef<TargetUsageRow, unknown>[] = [
    {
      id: 'target',
      meta: { width: 'md' },
      cell: ({ row }) =>
        row.original.target.target ? (
          <DataTableCell kind="text" value={row.original.target.slug} weight="medium" />
        ) : (
          <DataTableCell
            kind="text"
            tone="muted"
            value={`${row.original.target.slug} (no longer exists)`}
          />
        ),
    },
    {
      id: 'usage',
      meta: { width: 'fill' },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2">
          <Badge
            content={plural(row.original.count, 'request')}
            variants={{ variant: props.usage.tone, mono: props.usage.mono }}
          />
          <span className="text-xs text-fg-secondary">
            from {plural(row.original.operations, 'operation')}
          </span>
        </span>
      ),
    },
    {
      id: 'verify',
      meta: { align: 'right', width: 'md' },
      cell: ({ row }) =>
        row.original.target.target ? (
          <Button
            variant="primary"
            size="compact"
            render={
              <Link
                {...coordinateLink({
                  organizationSlug,
                  projectSlug,
                  targetSlug: row.original.target.target.slug,
                  coordinate: props.coordinate,
                })}
                target="_blank"
              />
            }
          >
            Verify in Insights
            <ExternalLinkIcon className="size-3" />
          </Button>
        ) : null,
    },
  ];
  return (
    <DataTable
      data={props.rows}
      columns={columns}
      getRowId={row => row.target.id}
      pagination={{ kind: 'none' }}
      variants={{ tone: 'critical' }}
      title={{
        label: props.title,
        icon: AlertTriangleIcon,
        aside: props.unused.length ? (
          <UnusedTargetsMenu unused={props.unused} coordinate={props.coordinate} />
        ) : undefined,
      }}
    />
  );
}

function UnusedTargetsMenu(props: { unused: PreviewTarget[]; coordinate: string }) {
  const { organizationSlug, projectSlug } = useSlugs('target');
  return (
    <Menu
      align="end"
      trigger={
        <Button variant="ghost" size="compact">
          {props.unused.length} without usage
          <ChevronDownIcon className="size-3" />
        </Button>
      }
      sections={[
        {
          label: 'No requests during the check window',
          items: props.unused.map(target =>
            target.target
              ? {
                  label: target.slug,
                  trailingIcon: ExternalLinkIcon,
                  render: (
                    <Link
                      {...coordinateLink({
                        organizationSlug,
                        projectSlug,
                        targetSlug: target.target.slug,
                        coordinate: props.coordinate,
                      })}
                      target="_blank"
                    />
                  ),
                }
              : { label: target.slug, disabled: true, tooltip: 'Target does no longer exist.' },
          ),
        },
      ]}
    />
  );
}

function ProposedChanges(props: {
  changes: ProposedChange[];
  targets: PreviewTarget[];
  usage: UsageStyle;
}) {
  return (
    <div>
      <h2 className="mb-3 font-bold text-fg-default">Breaking Changes</h2>
      <Accordion
        variant="boxed"
        multiple
        defaultValue={['0']}
        items={props.changes.map((change, key) => {
          const coordinate = change.path.join('.');
          const unused = unusedOf(change, props.targets);
          const rows = (change.affectedTargets ?? []).map(affected => ({
            target: affected.target,
            count: affected.count,
            operations: change.topAffectedOperations.filter(operation =>
              operation.affectedTargets?.some(a => a.target.id === affected.target.id),
            ).length,
          }));
          return {
            value: String(key),
            label: <span className="text-fg-secondary">{labelize(change.message)}</span>,
            trailing: (
              <span className="flex items-center gap-2">
                <Badge
                  content={`${rows.length} of ${plural(props.targets.length, 'target')}`}
                  variants={{ variant: 'outline' }}
                />
                <Badge
                  content={`${plural(change.topAffectedOperations.length, 'operation')} • ${plural(change.topAffectedClients.length, 'client')}`}
                  variants={{ variant: 'outline' }}
                />
              </span>
            ),
            content: (
              <div className="space-y-5">
                <section className="space-y-2">
                  <TargetsUsageTable
                    title={`Used in ${rows.length} of ${plural(props.targets.length, 'target')} during the check window`}
                    unused={unused}
                    rows={rows}
                    coordinate={coordinate}
                    usage={props.usage}
                  />
                </section>
                <section className="space-y-2">
                  <h4 className="text-sm font-medium text-fg">Affected operations and clients</h4>
                  <OperationsAndClients change={change} />
                </section>
              </div>
            ),
          };
        })}
      />
    </div>
  );
}


function ProposedView(props: {
  usedTargets: number;
  unusedTargets: number;
  operations: number;
  monoCount: boolean;
  countTone: UsageStyle['tone'];
}) {
  const used = clamp(props.usedTargets, 1, 3);
  const { targets, changes } = buildProposed({
    used,
    unused: clamp(props.unusedTargets, 0, TARGETS.length - used),
    operations: clamp(props.operations, 1, 3),
    legacy: false,
  });
  return (
    <RouterAt path={PATH}>
      <div className="w-[72rem]">
        <ProposedChanges
          changes={changes}
          targets={targets}
          usage={{ mono: props.monoCount, tone: props.countTone }}
        />
      </div>
    </RouterAt>
  );
}

const countControls = {
  monoCount: { type: 'boolean', label: 'Mono request badge', default: false },
  countTone: { type: 'select', options: ['outline', 'critical'], default: 'outline' },
  usedTargets: { type: 'number', label: 'Targets with usage (1-3)', default: 2 },
  unusedTargets: { type: 'number', label: 'Targets without usage (0-9)', default: 9 },
  operations: { type: 'number', label: 'Operations per change (1-3)', default: 2 },
} as const;

export const Proposed = createPreview({
  controls: controlsFor(ProposedView, countControls),
  render: v => <ProposedView {...v} />,
});


const CONTRACTS = [
  { id: 'contract-1', name: 'public-api', failed: true },
  { id: 'contract-2', name: 'partner-api', failed: true },
  { id: 'contract-3', name: 'internal', failed: false },
  { id: 'contract-4', name: 'mobile', failed: false },
];

const statusIcon = (failed: boolean) =>
  failed ? (
    <TriangleAlertIcon className="size-3.5 text-critical" />
  ) : (
    <GitCompareIcon className="size-3.5" />
  );

const CONTRACT_STATUS_LEGEND = [
  { icon: <TriangleAlertIcon className="size-3.5 text-critical" />, label: 'Failed' },
  { icon: <GitCompareIcon className="size-3.5" />, label: 'Schema changed' },
  { icon: <CheckIcon className="size-3.5 text-success" />, label: 'Passed' },
];

function CheckPageView(props: {
  monoCount: boolean;
  countTone: UsageStyle['tone'];
  usedTargets: number;
  unusedTargets: number;
  operations: number;
}) {
  const [graph, setGraph] = useState('default');
  const [tab, setTab] = useState('details');
  const used = clamp(props.usedTargets, 1, 3);
  const { targets, changes } = buildProposed({
    used,
    unused: clamp(props.unusedTargets, 0, TARGETS.length - used),
    operations: clamp(props.operations, 1, 3),
    legacy: false,
  });
  const failures = CONTRACTS.filter(contract => contract.failed);
  const selected = CONTRACTS.find(contract => contract.id === graph);

  return (
    <RouterAt path={PATH}>
      <div className="w-[72rem]">
        <div className="py-6">
          <Title>Check 629ff60a-8ef3-4ca6-8cff-ae0e9d17dad4</Title>
          <Subtitle>Detailed view of the schema check</Subtitle>
        </div>
        <div className="mb-3">
          <DescriptionList
            variants={{ termStyle: 'title', columns: 'auto' }}
            rows={[
              {
                items: [
                  { term: 'Status', description: <span className="text-critical">Failed</span> },
                  { term: 'Service', description: 'products' },
                  { term: 'Triggered', description: '1w ago by User' },
                ],
              },
            ]}
          />
        </div>
        <div className="mt-3 flex flex-col gap-3">
          <div className="mb-3">
            <ContractFailuresTable
              title={`${failures.length} of ${CONTRACTS.length} contracts failed`}
              aside={`${CONTRACTS.length - failures.length} passed`}
              items={failures.map(contract => ({
                key: contract.id,
                label: contract.name,
                reason: 'Composition failed.',
                detail: '1 error',
                onView: () => setGraph(contract.id),
              }))}
            />
          </div>
          <ScopeBar
            picker={
              <Select
                aria-label="Contract"
                value={graph}
                onValueChange={setGraph}
                label={
                  <span className="inline-flex items-center gap-1.5">
                    {statusIcon(true)}
                    {selected?.name ?? 'Default Graph'}
                  </span>
                }
                options={[
                  { value: 'default', label: 'Default Graph', trailing: statusIcon(true) },
                  ...CONTRACTS.map(contract => ({
                    value: contract.id,
                    label: contract.name,
                    trailing: statusIcon(contract.failed),
                  })),
                ]}
                size="compact"
                width="auto"
              />
            }
            legend={CONTRACT_STATUS_LEGEND}
          />
          <TabbedView
            value={tab}
            onValueChange={setTab}
            bodyPadding="none"
            items={[
              {
                value: 'details',
                label: 'Details',
                icon: ListIcon,
                content: (
                  <div className="p-5">
                    <div className="mb-5">
                      <ProposedChanges
                        changes={changes}
                        targets={targets}
                        usage={{ mono: props.monoCount, tone: props.countTone }}
                      />
                    </div>
                  </div>
                ),
              },
              { value: 'service', label: 'Service', icon: FileDiffIcon, content: null },
              { value: 'public', label: 'Public Schema', icon: FileDiffIcon, content: null },
              { value: 'supergraph', label: 'Supergraph', icon: FileDiffIcon, content: null },
              { value: 'policy', label: 'Policy', icon: TriangleAlertIcon, content: null },
            ]}
          />
        </div>
      </div>
    </RouterAt>
  );
}

export const OnTheCheckPage = createPreview({
  controls: controlsFor(CheckPageView, countControls),
  render: v => <CheckPageView {...v} />,
});
