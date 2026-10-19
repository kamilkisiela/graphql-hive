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
  Scale,
} from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { ContractFailuresTable } from '@/components/target/checks/contract-failures-table';
import { Badge } from '../primitives/badge/badge';
import { Button } from '../primitives/button/button';
import { Select } from '../primitives/floating/select/select';
import { Tooltip } from '../primitives/floating/tooltip/tooltip';
import { ScopeBar } from '../scope-bar/scope-bar';
import { TabbedView, type TabbedViewItem } from './tabbed-view';
import * as styles from './tabbed-view.preview.css';

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
  if (status === 'failed') return <AlertTriangle className={styles.statusGlyphAlertTriangle} />;
  if (status === 'changed') return <GitCompare className={styles.statusGlyphGitCompare} />;
  return <Check className={styles.statusGlyphCheck} />;
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
              <span className={styles.contractSelectSpan}>
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

function DetailsView({ contract }: { contract: string }) {
  return (
    <div className={styles.detailsViewDiv}>
      <div>
        <div className={styles.detailsViewDiv2}>
          Breaking Changes
          <Info className={styles.detailsViewInfo} />
        </div>
        <div className={styles.detailsViewDiv3}>
          <span className={styles.detailsViewSpan}>
            Field <Badge content="Node.id" variants={{ variant: 'secondary', mono: true }} />{' '}
            changed type from{' '}
            <Badge content="ID!" variants={{ variant: 'secondary', mono: true }} /> to{' '}
            <Badge content="ID" variants={{ variant: 'secondary', mono: true }} /> in {contract}
          </span>
          <ChevronDown className={styles.detailsViewChevronDown} />
        </div>
      </div>
      <div className={styles.detailsViewDiv4}>
        <p>
          Get more out of schema checks by enabling conditional breaking changes based on usage
          data.
        </p>
        <a href="#" className={styles.detailsViewA}>
          <BookOpen className={styles.detailsViewBookOpen} />
          Learn more about conditional breaking changes.
          <ExternalLink className={styles.detailsViewExternalLink} />
        </a>
      </div>
    </div>
  );
}

function SchemaView() {
  return (
    <pre className={styles.schemaViewPre}>
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
    { value: 'policy', label: 'Policy', icon: Scale, disabled: true, content: null },
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
    <div className={styles.div}>
      <div>
        <h2 className={styles.h2}>Check 5843350d-f323-4ff3-8dcf-a30bd48f451f</h2>
        <p className={styles.p}>Detailed view of the schema check</p>
      </div>
      <div className={styles.div2}>
        <div className={styles.div3}>
          <div>
            <div className={styles.div4}>Status</div>
            <div className={styles.div5}>Failed</div>
          </div>
          <div>
            <div className={styles.div6}>Triggered 3d ago</div>
            <div className={styles.div7}>by User</div>
          </div>
        </div>
        <Button variant="destructive">Approve</Button>
      </div>
      <div className={styles.div8}>
        <div className={styles.div9}>
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
    <div className={styles.div10}>
      <TabbedView
        value={view}
        onValueChange={setView}
        items={SERVICES.map(name => ({
          value: name,
          label: name,
          content: <p className={styles.p2}>The {name} view.</p>,
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
            <div className={styles.div11}>
              <div className={styles.div12}>Field Node.id changed type from ID! to ID</div>
              <div className={styles.div13}>Field User.email was removed</div>
            </div>
          ),
        },
        { value: 'schema', label: 'Schema', content: <SchemaView /> },
      ]}
    />
  ),
});
