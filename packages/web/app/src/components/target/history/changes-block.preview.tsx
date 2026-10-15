import { useState } from 'react';
import { FileDiffIcon, GitCompareIcon, ListIcon, TriangleAlertIcon } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { ContractFailuresTable } from '@/components/target/checks/contract-failures-table';
import { Subtitle, Title } from '@/components/ui/page';
import { DescriptionList } from '@/components/ui/primitives/description-list/description-list';
import { Select } from '@/components/ui/primitives/floating/select/select';
import { ScopeBar } from '@/components/ui/scope-bar/scope-bar';
import { TabbedView } from '@/components/ui/tabbed-view/tabbed-view';
import { RouterAt } from '../../../../foundry.router';
import { buildChanges, metadata, PATH } from './changes-block.fixtures';
import { ChangesBlock } from './errors-and-changes';

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
