import { useState } from 'react';
import { AlertTriangle, Check, GitCompare, List, Scale } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { ContractFailuresTable } from '@/components/target/checks/contract-failures-table';
import { buildChanges, metadata, PATH } from '@/components/target/history/changes-block.fixtures';
import { ChangesBlock } from '@/components/target/history/errors-and-changes';
import { Subtitle, Title } from '@/components/ui/page';
import { RouterAt } from '../../../../foundry.router';
import { Button } from '../primitives/button/button';
import { DescriptionList } from '../primitives/description-list/description-list';
import { Select } from '../primitives/floating/select/select';
import { Tooltip } from '../primitives/floating/tooltip/tooltip';
import { ScopeBar } from '../scope-bar/scope-bar';
import { TabbedView, type TabbedViewItem } from './tabbed-view';

export const nav: NavPath = 'Components/TabbedView';

type ContractStatus = 'failed' | 'changed' | 'ok';

const CONTRACTS: Array<{ value: string; label: string; status: ContractStatus }> = [
  { value: 'default', label: 'Default Graph', status: 'failed' },
  { value: 'public-api', label: 'public-api', status: 'changed' },
  { value: 'partner-api', label: 'partner-api', status: 'ok' },
  { value: 'mobile', label: 'mobile', status: 'failed' },
];

const STATUS_STATE: Record<ContractStatus, string> = {
  failed: 'Failed',
  changed: 'Schema changed',
  ok: 'No changes',
};

const STATUS_LABEL: Record<ContractStatus, string> = {
  failed: 'Composition failed.',
  changed: 'Schema changed',
  ok: 'Composition succeeded.',
};

function StatusGlyph({ status }: { status: ContractStatus }) {
  if (status === 'failed') return <AlertTriangle className="size-3.5 shrink-0 text-critical" />;
  if (status === 'changed') return <GitCompare className="size-3.5 shrink-0" />;
  return <Check className="size-3.5 shrink-0 text-success" />;
}

/** The picker as the pages build it: the contract's name, its status in words at the far end, the reason on hover. */
function ContractSelect(props: { value: string; onValueChange: (value: string) => void }) {
  return (
    <Select
      aria-label="Contract"
      options={CONTRACTS.map(entry => ({
        value: entry.value,
        label: entry.label,
        trailing: (
          <Tooltip
            trigger={
              <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
                <StatusGlyph status={entry.status} />
                {STATUS_STATE[entry.status]}
              </span>
            }
            content={STATUS_LABEL[entry.status]}
          />
        ),
      }))}
      value={props.value}
      onValueChange={props.onValueChange}
      size="compact"
      width="auto"
    />
  );
}

const FIXTURE = buildChanges({ usedTargets: 2, unusedTargets: 3, operations: 2, legacy: false });

function DetailsView() {
  return (
    <RouterAt path={PATH}>
      <ChangesBlock
        schemaCheckId="check-1"
        title="Breaking Changes"
        changesWithUsage={FIXTURE.changes}
        conditionBreakingChangeMetadata={metadata(FIXTURE.targets)}
      />
    </RouterAt>
  );
}

function SchemaView() {
  return (
    <pre className="font-mono text-xs leading-relaxed text-fg-default">
      {'type Query {\n  node(id: ID!): Node\n  viewer: User\n}\n\ninterface Node {\n  id: ID\n}'}
    </pre>
  );
}

function checkViews(): TabbedViewItem[] {
  return [
    {
      value: 'details',
      label: 'Details',
      icon: List,
      content: <DetailsView />,
    },
    { value: 'schema', label: 'Public Schema', icon: GitCompare, content: <SchemaView /> },
    {
      value: 'supergraph',
      label: 'Supergraph',
      icon: GitCompare,
      disabled: true,
      tooltip: 'Composition did not succeed. No Supergraph available.',
      content: null,
    },
    { value: 'policy', label: 'Policy', icon: Scale, disabled: true, content: null },
  ];
}

export const Default = createPreview(() => (
  <div className="w-[72rem]">
    <TabbedView items={checkViews()} defaultValue="details" />
  </div>
));

/** The contract failures table lists contracts only: the default graph's failure is the view the page opens on. */
export const ChecksPage = createPreview(() => {
  const [contract, setContract] = useState('default');
  const failed = CONTRACTS.filter(entry => entry.value !== 'default' && entry.status === 'failed');
  return (
    <div className="flex w-[72rem] flex-col">
      <div className="py-6">
        <Title>Check 5843350d-f323-4ff3-8dcf-a30bd48f451f</Title>
        <Subtitle>Detailed view of the schema check</Subtitle>
      </div>
      <div className="mb-3 flex items-center gap-4 rounded-md border bg-surface-card px-5 py-4">
        <div className="min-w-0 flex-1">
          <DescriptionList
            variants={{ termStyle: 'title', columns: 'auto' }}
            rows={[
              {
                items: [
                  { term: 'Status', description: <span className="text-critical">Failed</span> },
                  { term: 'Triggered', description: '3d ago by User' },
                ],
              },
            ]}
          />
        </div>
        <Button variant="destructive">Approve</Button>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        <div className="mb-3">
          <ContractFailuresTable
            title={`${failed.length} of ${CONTRACTS.length - 1} contracts failed`}
            aside={`${CONTRACTS.length - 1 - failed.length} passed`}
            items={failed.map(entry => ({
              key: entry.value,
              label: entry.label,
              reason: STATUS_LABEL.failed,
              detail: '2 errors',
              onView: () => setContract(entry.value),
            }))}
          />
        </div>
        <ScopeBar picker={<ContractSelect value={contract} onValueChange={setContract} />} />
        <TabbedView items={checkViews()} defaultValue="details" />
      </div>
    </div>
  );
});

const SERVICES = [
  'users',
  'products',
  'reviews',
  'inventory',
  'orders',
  'billing',
  'search',
  'notifications',
];

/** More tabs than fit: the strip scrolls instead of stretching the column. */
export const ManyTabs = createPreview(() => {
  const [view, setView] = useState(SERVICES[0]);
  return (
    <div className="flex w-[32rem] flex-col">
      <TabbedView
        value={view}
        onValueChange={setView}
        items={SERVICES.map(name => ({
          value: name,
          label: name,
          content: <p className="text-sm text-fg-default">The {name} view.</p>,
        }))}
      />
    </div>
  );
});

export const Playground = createPreview({
  controls: controlsFor(TabbedView, {
    bodyPadding: { type: 'radio', options: ['default', 'none'], default: 'default' },
  }),
  render: v => (
    <TabbedView
      bodyPadding={v.bodyPadding}
      defaultValue="changes"
      items={[
        {
          value: 'changes',
          label: 'Changes',
          content: (
            <div className="divide-y divide-line text-sm text-fg-default">
              <div className="px-5 py-3">Field Node.id changed type from ID! to ID</div>
              <div className="px-5 py-3">Field User.email was removed</div>
            </div>
          ),
        },
        { value: 'schema', label: 'Schema', content: <SchemaView /> },
      ]}
    />
  ),
});
