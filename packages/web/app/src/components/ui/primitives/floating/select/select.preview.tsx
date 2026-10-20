import { useState } from 'react';
import { AlertTriangle, Check, GitCompare } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { cn } from '@/lib/utils';
import { Button } from '../../button/button';
import { Card } from '../../card/card';
import { StatusDot } from '../../status-dot/status-dot';
import { floatingVariants } from '../shared-styles';
import { Select, type SelectOption } from './select';

export const nav: NavPath = 'Primitives/Floating/Select';

const METRICS: SelectOption[] = [
  { value: 'TRAFFIC', label: 'Total requests' },
  { value: 'ERROR_RATE', label: 'Error rate' },
  { value: 'LATENCY:p99', label: 'p99 latency' },
  { value: 'LATENCY:p95', label: 'p95 latency' },
];

const CLIENTS: SelectOption[] = [
  'Hive CLI',
  'hive-gateway',
  'graphql-yoga',
  'apollo-rover',
  'graphql-mesh',
  'cosmo-router',
  'federation-gateway',
  'stellate-edge',
  'grafbase-cli',
  'envelop-plugin',
].map(name => ({ value: name, label: name }));

export const Default = createPreview(() => {
  const [value, setValue] = useState('TRAFFIC');
  return <Select options={METRICS} value={value} onValueChange={setValue} />;
});

export const Placeholder = createPreview(() => {
  const [value, setValue] = useState<string | undefined>(undefined);
  return (
    <Select options={METRICS} value={value} onValueChange={setValue} placeholder="Choose metric…" />
  );
});

/** `searchable` adds a filter input and a fixed-height scroll area to the popup. */
export const Searchable = createPreview(() => {
  const [value, setValue] = useState('Hive CLI');
  return <Select options={CLIENTS} value={value} onValueChange={setValue} searchable />;
});

export const WithIcons = createPreview(() => {
  const [value, setValue] = useState('healthy');
  return (
    <Select
      options={[
        {
          value: 'healthy',
          label: 'Healthy',
          icon: <StatusDot color="success" />,
        },
        {
          value: 'degraded',
          label: 'Degraded',
          icon: <StatusDot color="warning" />,
        },
        { value: 'down', label: 'Down', icon: <StatusDot color="critical" /> },
      ]}
      value={value}
      onValueChange={setValue}
    />
  );
});

export const CustomTrigger = createPreview(() => {
  const [value, setValue] = useState('TRAFFIC');
  return (
    <Select
      options={METRICS}
      value={value}
      onValueChange={setValue}
      trigger={
        <Button label={METRICS.find(o => o.value === value)?.label ?? 'Pick…'} variant="action" />
      }
    />
  );
});

export const Disabled = createPreview(() => <Select options={METRICS} value="TRAFFIC" disabled />);

/**
 * `label` overrides the trigger text. The sort selects say "Requests" while the option reads
 * "Requests · GraphQL requests made in the last 30 days"; the proposals editor holds `value=""`
 * forever and reads "Select a service…" because it is an add action, not a selection.
 */
export const WithLabel = createPreview(() => {
  const [value, setValue] = useState('requests');
  // The editor's shape: each pick moves a service out of the options and into the list, and
  // the trigger is disabled once nothing is left to add.
  const [added, setAdded] = useState<string[]>([]);
  const remaining = ['products', 'reviews', 'inventory'].filter(s => !added.includes(s));
  return (
    <div className="flex items-center gap-6">
      <Select
        options={[
          { value: 'requests', label: 'Requests' },
          { value: 'versions', label: 'Schema Versions' },
          { value: 'name', label: 'Name' },
        ]}
        value={value}
        onValueChange={setValue}
        label={`Sort by ${value}`}
      />
      <div className="flex items-center gap-3">
        <Select
          options={remaining.map(s => ({ value: s, label: s }))}
          value=""
          onValueChange={s => setAdded(prev => [...prev, s])}
          label="Select a service…"
          disabled={remaining.length === 0}
        />
        <span className="text-xs text-fg-default">
          {added.length ? `Added: ${added.join(', ')}` : 'Nothing added yet'}
        </span>
      </div>
    </div>
  );
});

/**
 * `description` is the second line under a label. The role picker, the two sort selects and the
 * collection picker all had one, hand-built as a nested div.
 */
export const WithDescriptions = createPreview(() => {
  const [value, setValue] = useState('requests');
  return (
    <Select
      options={[
        {
          value: 'requests',
          label: 'Requests',
          description: 'GraphQL requests made in the last 30 days.',
        },
        {
          value: 'versions',
          label: 'Schema Versions',
          description: 'Schemas published in last 30 days.',
        },
        { value: 'name', label: 'Name', description: 'Sort by project name.' },
      ]}
      value={value}
      onValueChange={setValue}
    />
  );
});

/**
 * A disabled option keeps its description, so the reason it cannot be picked is on the row
 * rather than behind a hover.
 */
export const DisabledOptions = createPreview(() => {
  const [value, setValue] = useState('read-only');
  return (
    <Select
      options={[
        { value: 'no-access', label: 'No access', description: "Can't downgrade", disabled: true },
        { value: 'read-only', label: 'Read-only' },
        { value: 'read-write', label: 'Read & write' },
      ]}
      value={value}
      onValueChange={setValue}
    />
  );
});

/**
 * `tooltip` explains an option on hover, and works on a disabled one, which is what it is for:
 * the description says what the role grants, the tooltip says why you cannot grant it. The role
 * picker on the invite form is the call site.
 */
export const WithTooltips = createPreview(() => {
  const [value, setValue] = useState('viewer');
  return (
    <Select
      options={[
        {
          value: 'admin',
          label: 'Admin',
          description: 'Full access to the organization',
          disabled: true,
          tooltip: 'Not enough permissions',
        },
        {
          value: 'developer',
          label: 'Developer',
          description: 'Can publish schemas and manage targets',
        },
        { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
      ]}
      value={value}
      onValueChange={setValue}
      searchable
    />
  );
});

/**
 * `size` is the shared `controlSize` ladder, passed through to the trigger Button. `default`
 * (36px) is what a select in a form gets; `compact` (30px) is for a select that sits in a filter
 * row beside chips and a date picker, which are 30px.
 */
/**
 * `trailing` sits at the row's far end, clear of the selection check in the leading slot: a
 * status, a count, a shortcut. The contract pickers on the check and version pages put each
 * contract's composition status there.
 */
export const WithTrailing = createPreview(() => {
  const [value, setValue] = useState('default');
  return (
    <Select
      options={[
        {
          value: 'default',
          label: 'Default Graph',
          trailing: <AlertTriangle className="size-3.5 text-warning" />,
        },
        { value: 'public-api', label: 'public-api', trailing: <GitCompare className="size-3.5" /> },
        {
          value: 'partner-api',
          label: 'partner-api',
          trailing: <Check className="size-3.5 text-success" />,
        },
      ]}
      value={value}
      onValueChange={setValue}
      width="md"
    />
  );
});

export const Sizes = createPreview(() => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center gap-4">
      <span className="w-16 text-xs text-fg-muted">default</span>
      <Select options={METRICS} value="TRAFFIC" />
      <Button variant="primary">Save</Button>
    </div>
    <div className="flex items-center gap-4">
      <span className="w-16 text-xs text-fg-muted">compact</span>
      <Select options={METRICS} value="TRAFFIC" size="compact" />
      <Button label="Filter" size="compact" />
    </div>
  </div>
));

export const Widths = createPreview(() => (
  <div className="flex w-[28rem] flex-col items-start gap-3">
    <Select options={METRICS} value="TRAFFIC" />
    <Select options={METRICS} value="TRAFFIC" width="sm" />
    <Select options={METRICS} value="TRAFFIC" width="md" />
    <Select options={METRICS} value="TRAFFIC" width="lg" />
    <Select options={METRICS} value="TRAFFIC" width="full" />
  </div>
));

/**
 * `matchTriggerWidth` pins the popup to the trigger, for a fixed-width trigger whose longest
 * option would otherwise push the panel wider than the control.
 */
export const MatchTriggerWidth = createPreview(() => {
  const [value, setValue] = useState('c1');
  const collections = [
    { value: 'c1', label: 'Onboarding', description: 'Queries used in the getting-started guide' },
    { value: 'c2', label: 'Regression', description: 'Operations replayed before every release' },
  ];
  return (
    <div className="flex items-start gap-6">
      <Select options={collections} value={value} onValueChange={setValue} width="sm" />
      <Select
        options={collections}
        value={value}
        onValueChange={setValue}
        width="sm"
        matchTriggerWidth
      />
    </div>
  );
});

/**
 * `onSurface="raised"` lifts the trigger's fill one step above a card or a floating panel, where
 * the base fill would match the surface and leave only a border. The two panels are the two
 * raised surfaces in the app, which differ in dark (a card is neutral-3, a popover neutral-4);
 * each holds a base trigger above a raised one.
 */
export const OnSurface = createPreview(() => {
  const [value, setValue] = useState('private');
  const options = [
    { value: 'private', label: 'My views' },
    { value: 'shared', label: 'Shared views' },
  ];
  const pair = (
    <>
      <Select options={options} value={value} onValueChange={setValue} />
      <Select options={options} value={value} onValueChange={setValue} onSurface="raised" />
    </>
  );
  return (
    <div className="flex flex-wrap gap-6">
      <div className="w-[20rem]">
        <Card variants={{ onSurface: 'raised' }}>
          <div className="flex flex-col gap-3">
            <span className="text-xs text-fg-default">A card</span>
            {pair}
          </div>
        </Card>
      </div>
      <div className={cn(floatingVariants({ padding: 'md' }), 'flex w-[20rem] flex-col gap-3 p-4')}>
        <span className="text-xs text-fg-default">A floating panel</span>
        {pair}
      </div>
    </div>
  );
});

export const Playground = createPreview({
  controls: controlsFor(Select, {
    options: {
      type: 'list',
      of: {
        value: { type: 'text' },
        label: { type: 'text', default: 'Option' },
        description: { type: 'text' },
        tooltip: { type: 'text' },
        disabled: { type: 'boolean', default: false },
      },
      default: [
        {
          value: 'requests',
          label: 'Requests',
          description: 'GraphQL requests made in the last 30 days.',
        },
        {
          value: 'versions',
          label: 'Schema Versions',
          description: 'Schemas published in last 30 days.',
        },
        { value: 'name', label: 'Name', description: 'Sort by project name.' },
      ],
    },
    placeholder: { type: 'text', default: 'Select…' },
    // The trigger reads `label ?? selectedLabel ?? placeholder`, so an empty string would blank it.
    label: { type: 'text', default: '', derive: text => text || undefined },
    searchable: { type: 'boolean', default: false },
    disabled: { type: 'boolean', default: false },
    matchTriggerWidth: { type: 'boolean', default: false },
    size: { type: 'radio', options: ['default', 'compact'], default: 'default' },
    onSurface: { type: 'radio', options: ['base', 'raised'], default: 'base' },
    width: { type: 'radio', options: ['auto', 'sm', 'md', 'lg', 'full'], default: 'auto' },
    side: { type: 'radio', options: ['bottom', 'top', 'left', 'right'], default: 'bottom' },
    align: { type: 'radio', options: ['start', 'center', 'end'], default: 'start' },
  }),
  // Starts unselected so the placeholder shows; picking an option fills the trigger.
  render: v => {
    const [value, setValue] = useState<string | undefined>(undefined);
    return (
      <div className="w-[28rem]">
        <Select
          options={v.options}
          value={value}
          onValueChange={setValue}
          placeholder={v.placeholder}
          label={v.label}
          searchable={v.searchable}
          disabled={v.disabled}
          matchTriggerWidth={v.matchTriggerWidth}
          size={v.size}
          onSurface={v.onSurface}
          width={v.width}
          side={v.side}
          align={v.align}
        />
      </div>
    );
  },
});
