import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ExternalLink,
  GitCompare,
  Info,
  List,
} from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { ContractFailuresTable } from '@/components/target/checks/contract-failures-table';
import { Badge } from '../primitives/badge/badge';
import { Button } from '../primitives/button/button';
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

/** The picker as the pages build it: the contract's name, its status under a tooltip at the far end. */
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
              <span className="inline-flex">
                <StatusGlyph status={entry.status} />
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

function DetailsView({ contract }: { contract: string }) {
  return (
    <div className="flex flex-col gap-6 text-sm">
      <div>
        <div className="mb-3 flex items-center gap-2 font-medium text-fg">
          Breaking Changes
          <Info className="size-3.5 text-fg-secondary" />
        </div>
        <div className="flex items-center justify-between border-b border-line py-2">
          <span className="text-fg-default">
            Field <Badge content="Node.id" variants={{ variant: 'secondary', mono: true }} />{' '}
            changed type from{' '}
            <Badge content="ID!" variants={{ variant: 'secondary', mono: true }} /> to{' '}
            <Badge content="ID" variants={{ variant: 'secondary', mono: true }} /> in {contract}
          </span>
          <ChevronDown className="size-4 text-fg-secondary" />
        </div>
      </div>
      <div className="flex flex-col gap-2 text-fg-default">
        <p>
          Get more out of schema checks by enabling conditional breaking changes based on usage
          data.
        </p>
        <a href="#" className="inline-flex items-center gap-2 hover:text-fg">
          <BookOpen className="size-4" />
          Learn more about conditional breaking changes.
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}

function SchemaView() {
  return (
    <pre className="font-mono text-xs leading-relaxed text-fg-default">
      {'type Query {\n  node(id: ID!): Node\n  viewer: User\n}\n\ninterface Node {\n  id: ID\n}'}
    </pre>
  );
}

function checkViews(contract: string): TabbedViewItem[] {
  return [
    {
      value: 'details',
      label: 'Details',
      icon: List,
      content: <DetailsView contract={contract} />,
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
    { value: 'policy', label: 'Policy', icon: AlertTriangle, disabled: true, content: null },
  ];
}

export const Default = createPreview(() => (
  <TabbedView items={checkViews('Default Graph')} defaultValue="details" />
));

/** The contract failures table lists contracts only: the default graph's failure is the view the page opens on. */
export const ChecksPage = createPreview(() => {
  const [contract, setContract] = useState('default');
  const failed = CONTRACTS.filter(entry => entry.value !== 'default' && entry.status === 'failed');
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-medium text-fg">Check 5843350d-f323-4ff3-8dcf-a30bd48f451f</h2>
        <p className="text-sm text-fg-secondary">Detailed view of the schema check</p>
      </div>
      <div className="flex items-center justify-between rounded-md border border-line bg-neutral-2 px-5 py-4 dark:bg-neutral-3">
        <div className="flex gap-24">
          <div>
            <div className="text-xs text-fg-secondary">Status</div>
            <div className="text-sm font-medium text-critical">Failed</div>
          </div>
          <div>
            <div className="text-xs text-fg-secondary">Triggered 3d ago</div>
            <div className="text-sm text-fg">by User</div>
          </div>
        </div>
        <Button variant="destructive">Approve</Button>
      </div>
      <div className="flex flex-col gap-3">
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
        <ScopeBar
          picker={<ContractSelect value={contract} onValueChange={setContract} />}
          legend={[
            { icon: <StatusGlyph status="failed" />, label: 'Failed' },
            { icon: <StatusGlyph status="changed" />, label: 'Schema changed' },
            { icon: <StatusGlyph status="ok" />, label: 'Passed' },
          ]}
        />
        <TabbedView items={checkViews(contract)} defaultValue="details" />
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
