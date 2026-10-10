import { useState } from 'react';
import { CheckIcon, FileDiffIcon, GitCompareIcon, ListIcon, TriangleAlertIcon } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { ContractFailuresTable } from '@/components/target/checks/contract-failures-table';
import { Subtitle, Title } from '@/components/ui/page';
import { DescriptionList } from '@/components/ui/primitives/description-list/description-list';
import { Select } from '@/components/ui/primitives/floating/select/select';
import { ScopeBar } from '@/components/ui/scope-bar/scope-bar';
import { TabbedView } from '@/components/ui/tabbed-view/tabbed-view';
import { makeFragmentData } from '@/gql';
import { SeverityLevelType } from '@/gql/graphql';
import { RouterAt } from '../../../../foundry.router';
import {
  ChangesBlock,
  ChangesBlock_SchemaChangeWithUsageFragment,
  ChangesBlock_SchemaCheckConditionalBreakingChangeMetadataFragment,
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const targetUsage = (target: PreviewTarget, count: number) => ({
  __typename: 'SchemaChangeUsageStatisticsAffectedTarget' as const,
  target: {
    __typename: 'BreakingChangeMetadataTarget' as const,
    id: target.id,
    slug: target.slug,
    target: target.target ? { __typename: 'Target' as const, ...target.target } : null,
  },
  count,
  countFormatted: String(count),
});

// Later operations reach fewer targets, so their "Seen in" differs from the change's.
function buildChanges(args: {
  usedTargets: number;
  unusedTargets: number;
  operations: number;
  legacy: boolean;
}) {
  const usedCount = clamp(args.usedTargets, 1, 3);
  const targets = TARGETS.slice(
    0,
    usedCount + clamp(args.unusedTargets, 0, TARGETS.length - usedCount),
  );
  const used = targets.slice(0, usedCount);
  const spread = (index: number) =>
    index === 0 ? used : index === 1 ? used.slice(0, 1) : used.slice(-1);

  const changes = CHANGES.map(change => {
    const operations = Array.from({ length: clamp(args.operations, 1, 3) }, (_, index) => ({
      targets: spread(index),
      name: index === 0 ? change.operation : `${change.operation}${index + 1}`,
      hash: hashOf(change.hash, index),
    }));
    const countFor = (target: PreviewTarget) =>
      operations.filter(operation => operation.targets.includes(target)).length;
    const total = operations.reduce((sum, operation) => sum + operation.targets.length, 0);

    return makeFragmentData(
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
          topAffectedOperations: operations.map(operation => ({
            __typename: 'SchemaChangeUsageStatisticsAffectedOperation' as const,
            hash: operation.hash,
            name: operation.name,
            countFormatted: String(operation.targets.length),
            percentageFormatted: '<0.01%',
            affectedTargets: args.legacy
              ? null
              : operation.targets.map(target => targetUsage(target, 1)),
          })),
          topAffectedClients: CLIENTS.map(client => ({
            __typename: 'SchemaChangeUsageStatisticsAffectedClient' as const,
            ...client,
            countFormatted: args.legacy ? client.countFormatted : String(total),
          })),
          affectedTargets: args.legacy
            ? null
            : used.map(target => targetUsage(target, countFor(target))),
        },
        affectedAppDeployments: null,
      },
      ChangesBlock_SchemaChangeWithUsageFragment,
    );
  });

  return { targets, changes };
}

function ChangesView(props: {
  usedTargets: number;
  unusedTargets: number;
  operations: number;
  legacy: boolean;
}) {
  const { targets, changes } = buildChanges(props);
  return (
    <RouterAt path={PATH}>
      <div className="w-[72rem]">
        <ChangesBlock
          schemaCheckId="check-1"
          title="Breaking Changes"
          changesWithUsage={changes}
          conditionBreakingChangeMetadata={metadata(targets)}
        />
      </div>
    </RouterAt>
  );
}

const countControls = {
  usedTargets: { type: 'number', label: 'Targets with usage (1-3)', default: 2 },
  unusedTargets: { type: 'number', label: 'Targets without usage (0-9)', default: 9 },
  operations: { type: 'number', label: 'Operations per change (1-3)', default: 2 },
} as const;

/** A check stored before per-target counts were kept: the target list is the check's settings. */
export const Today = createPreview(() => (
  <ChangesView usedTargets={1} unusedTargets={10} operations={1} legacy />
));

export const WithTargets = createPreview({
  controls: controlsFor(ChangesView, {
    ...countControls,
    legacy: { type: 'boolean', label: 'Stored before per-target counts', default: false },
  }),
  render: v => <ChangesView {...v} />,
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

function CheckPageView(props: { usedTargets: number; unusedTargets: number; operations: number }) {
  const [graph, setGraph] = useState('default');
  const [tab, setTab] = useState('details');
  const { targets, changes } = buildChanges({ ...props, legacy: false });
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
                      <ChangesBlock
                        schemaCheckId="check-1"
                        title="Breaking Changes"
                        changesWithUsage={changes}
                        conditionBreakingChangeMetadata={metadata(targets)}
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
