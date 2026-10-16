import { useState } from 'react';
import { FileDiffIcon, GitCompareIcon, ListIcon, TriangleAlertIcon } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { ContractFailuresTable } from '@/components/target/checks/contract-failures-table';
import { Subtitle, Title } from '@/components/ui/page';
import { DescriptionList } from '@/components/ui/primitives/description-list/description-list';
import { Select } from '@/components/ui/primitives/floating/select/select';
import { ScopeBar } from '@/components/ui/scope-bar/scope-bar';
import { TabbedView } from '@/components/ui/tabbed-view/tabbed-view';
import { makeFragmentData } from '@/gql';
import { SchemaChangeKind, SchemaChangeUsageTracking, SeverityLevelType } from '@/gql/graphql';
import { RouterAt } from '../../../../foundry.router';
import { buildChanges, metadata, PATH } from './changes-block.fixtures';
import {
  ChangesBlock,
  ChangesBlock_SchemaChangeFragment,
  ChangesBlock_SchemaChangeWithUsageFragment,
} from './errors-and-changes';

export const nav: NavPath = 'Components/ChangesBlock';

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

// Inspector's messages and reasons, verbatim. A change marked safe based on usage whose usage is
// never recorded gets an honest label, and a change with nothing to show is a static row.
const USAGE_LABEL_CHANGES = [
  {
    path: ['Currency'],
    message: "Type 'Currency' was removed",
    severityReason: null,
    usageTracking: SchemaChangeUsageTracking.OnReferencingFields,
    kind: SchemaChangeKind.TypeRemoved,
  },
  {
    // Reached only through an interface, so no field change on the check points at it.
    path: ['Dog'],
    message: "Type 'Dog' was removed",
    severityReason: null,
    usageTracking: SchemaChangeUsageTracking.OnReferencingFields,
    kind: SchemaChangeKind.TypeRemoved,
  },
  {
    path: ['SearchResult'],
    message: "Member 'Movie' was removed from Union type 'SearchResult'",
    severityReason:
      'Removing a union member from a union can cause existing queries that use this union member in a fragment spread to error.',
    usageTracking: SchemaChangeUsageTracking.NotTracked,
    kind: SchemaChangeKind.UnionMemberRemoved,
  },
  {
    path: ['Status'],
    message: "'Status' kind changed from 'EnumTypeDefinition' to 'ScalarTypeDefinition'",
    severityReason:
      'Changing the kind of a type is a breaking change because it can cause existing queries to error. For example, turning an object type to a scalar type would break queries that define a selection set for this type.',
    usageTracking: SchemaChangeUsageTracking.NotTracked,
    kind: SchemaChangeKind.TypeKindChanged,
  },
  {
    path: ['Query', 'products', 'region'],
    message: "Argument 'region: String!' added to field 'Query.products'",
    severityReason: null,
    usageTracking: SchemaChangeUsageTracking.NotTracked,
    kind: SchemaChangeKind.FieldArgumentAdded,
  },
  {
    // Usage is recorded for fields, so "safe based on usage" holds here.
    path: ['User', 'legacyId'],
    message: "Field 'legacyId' was removed from object type 'User'",
    severityReason:
      'Removing a field is a breaking change. It is preferable to deprecate the field before removing it. This applies to removed union fields as well, since removal breaks client operations that contain fragments that reference the removed type through direct (... on RemovedType) or indirect means such as __typename in the consumers.',
    usageTracking: SchemaChangeUsageTracking.Tracked,
    kind: SchemaChangeKind.FieldRemoved,
  },
].map(change =>
  makeFragmentData(
    {
      __typename: 'SchemaChange' as const,
      ...change,
      severityLevel: SeverityLevelType.Breaking,
      isSafeBasedOnUsage: true,
      approval: null,
      usageStatistics: null,
      affectedAppDeployments: null,
    },
    ChangesBlock_SchemaChangeWithUsageFragment,
  ),
);

/** Breaking changes the check found no usage for, labelled by whether usage is recorded at all. */
export const UsageLabels = createPreview(() => (
  <RouterAt path={PATH}>
    <div className="w-[72rem]">
      <ChangesBlock
        schemaCheckId="check-1"
        title="Breaking Changes"
        changesWithUsage={USAGE_LABEL_CHANGES}
        conditionBreakingChangeMetadata={null}
      />
    </div>
  </RouterAt>
));

// Inspector's messages, verbatim, as a safe-change group and a version list render them.
function plainChange(change: {
  path: string[];
  message: string;
  kind: SchemaChangeKind;
  breaking?: boolean;
}) {
  return makeFragmentData(
    {
      __typename: 'SchemaChange' as const,
      path: change.path,
      message: change.message,
      kind: change.kind,
      severityLevel: change.breaking ? SeverityLevelType.Breaking : SeverityLevelType.Safe,
      severityReason: null,
      approval: null,
      isSafeBasedOnUsage: false,
      usageTracking: SchemaChangeUsageTracking.NotTracked,
    },
    ChangesBlock_SchemaChangeFragment,
  );
}

const CHECK_SAFE_CHANGES = [
  plainChange({
    path: ['NewThing'],
    message: "Type 'NewThing' was added",
    kind: SchemaChangeKind.TypeAdded,
  }),
  plainChange({
    path: ['User', 'email'],
    message: "Field 'email' was added to object type 'User'",
    kind: SchemaChangeKind.FieldAdded,
  }),
  plainChange({
    path: ['User'],
    message: "Description 'old' on type 'User' has changed to 'new'",
    kind: SchemaChangeKind.TypeDescriptionChanged,
  }),
];

const VERSION_CHANGES = [
  plainChange({
    path: ['User', 'email'],
    message: "Field 'email' was added to object type 'User'",
    kind: SchemaChangeKind.FieldAdded,
  }),
  plainChange({
    path: ['User', 'legacyId'],
    message: "Field 'legacyId' was removed from object type 'User'",
    kind: SchemaChangeKind.FieldRemoved,
    breaking: true,
  }),
  plainChange({
    path: ['Status'],
    message: "'Status' kind changed from 'EnumTypeDefinition' to 'ScalarTypeDefinition'",
    kind: SchemaChangeKind.TypeKindChanged,
    breaking: true,
  }),
  plainChange({
    path: ['@cacheControl'],
    message: "Directive 'cacheControl' was removed",
    kind: SchemaChangeKind.DirectiveRemoved,
    breaking: true,
  }),
];

/**
 * An Explorer link beside each change whose coordinate the latest version has. A check hides its
 * additions; a version hides its removals; directives never link.
 */
export const ExplorerLinks = createPreview(() => (
  <RouterAt path={PATH}>
    <div className="w-[72rem] space-y-8">
      <ChangesBlock
        schemaCheckId="check-1"
        title="Breaking Changes"
        explorerLinks="check"
        changesWithUsage={USAGE_LABEL_CHANGES}
        conditionBreakingChangeMetadata={null}
      />
      <ChangesBlock schemaCheckId="check-1" explorerLinks="check" changes={CHECK_SAFE_CHANGES} />
      <ChangesBlock
        title="Changes in this version"
        explorerLinks="version"
        changes={VERSION_CHANGES}
      />
    </div>
  </RouterAt>
));
