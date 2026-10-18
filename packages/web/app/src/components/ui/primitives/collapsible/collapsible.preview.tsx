import { useState } from 'react';
import { Eraser } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Filter, FilterOption } from '@/pages/traces/target-traces-filter';
import { Button } from '../button/button';
import { ScrollArea } from '../scroll-area/scroll-area';
import { Collapsible } from './collapsible';

export const nav: NavPath = 'Primitives/Collapsible';

const STATUS = [
  { label: 'ok', count: 1204 },
  { label: 'error', count: 37 },
];
const ERROR_CODES = [
  { label: 'GRAPHQL_VALIDATION_FAILED', count: 21 },
  { label: 'UNAUTHENTICATED', count: 9 },
  { label: 'INTERNAL_SERVER_ERROR', count: 7 },
];

function FilterRows(props: { rows: { label: string; count: number }[] }) {
  const [selected, setSelected] = useState(['ok']);
  return (
    <div className="flex w-full min-w-0 flex-col gap-1 text-sm">
      {props.rows.map(row => (
        <FilterOption
          key={row.label}
          selected={selected.includes(row.label)}
          count={row.count}
          onClick={() =>
            setSelected(prev =>
              prev.includes(row.label) ? prev.filter(l => l !== row.label) : [...prev, row.label],
            )
          }
        >
          {row.label}
        </FilterOption>
      ))}
    </div>
  );
}

// `section` as the traces filter column ships it: `Filter` owns the trigger, the reset count in
// `actions`, and the separator beneath.
export const Section = createPreview(() => {
  const [status, setStatus] = useState(['ok']);
  const [codes, setCodes] = useState<string[]>([]);
  const toggle = (set: typeof setStatus) => (label: string) =>
    set(prev => (prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]));
  return (
    <div className="flex w-64 flex-col text-fg-default">
      <Filter name="Status" changes={status.length} onReset={() => setStatus([])}>
        {STATUS.map(row => (
          <FilterOption
            key={row.label}
            selected={status.includes(row.label)}
            count={row.count}
            onClick={() => toggle(setStatus)(row.label)}
          >
            {row.label}
          </FilterOption>
        ))}
      </Filter>
      <Filter name="Error Code" changes={codes.length} onReset={() => setCodes([])}>
        {ERROR_CODES.map(row => (
          <FilterOption
            key={row.label}
            selected={codes.includes(row.label)}
            count={row.count}
            onClick={() => toggle(setCodes)(row.label)}
          >
            {row.label}
          </FilterOption>
        ))}
      </Filter>
    </div>
  );
});

const LOGS = [
  'info: 1',
  'warn: true',
  'error: Fatal',
  'log: preflight script executed in 12ms',
  'log: setting header x-tenant',
  'info: done',
  'log: preflight script executed in 9ms',
  'info: done',
];

// `panel` as the laboratory's preflight logs use it: the clear button shows only while open.
export const Panel = createPreview(() => {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex max-h-[200px] w-[36rem] flex-col overflow-hidden rounded-md border border-line bg-neutral-1">
      <Collapsible
        variant="panel"
        trigger="Preflight Script Logs"
        open={open}
        onOpenChange={setOpen}
        actions={
          open ? (
            <Button layout="iconOnly" icon={Eraser} aria-label="Clear logs" variant="ghost" />
          ) : null
        }
      >
        <ScrollArea fill>
          <div className="p-4 font-mono text-xs/[18px] text-fg-default">
            {LOGS.map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        </ScrollArea>
      </Collapsible>
    </div>
  );
});

export const Controlled = createPreview(() => {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex w-64 flex-col gap-3 text-sm text-fg-default">
      <Button variant="outline" onClick={() => setOpen(prev => !prev)}>
        {open ? 'Collapse' : 'Expand'} from outside
      </Button>
      <Collapsible trigger="Status" open={open} onOpenChange={setOpen}>
        <FilterRows rows={STATUS} />
      </Collapsible>
    </div>
  );
});

export const Playground = createPreview({
  controls: controlsFor(Collapsible, {
    variant: { type: 'radio', options: ['section', 'panel'], default: 'section' },
    trigger: { type: 'text', default: 'Status' },
    actions: {
      type: 'radio',
      options: ['none', 'clear'],
      default: 'none',
      derive: kind =>
        kind === 'clear' ? (
          <Button layout="iconOnly" icon={Eraser} aria-label="Clear" variant="ghost" />
        ) : undefined,
    },
    defaultOpen: { type: 'boolean', default: true },
  }),
  render: v => (
    <div
      className={
        v.variant === 'panel'
          ? 'w-[36rem] overflow-hidden rounded-md border border-line bg-neutral-1'
          : 'w-64 p-2 text-fg-default'
      }
    >
      {/* `defaultOpen` is read once at mount, so the key remounts on a change. */}
      <Collapsible
        key={String(v.defaultOpen)}
        variant={v.variant}
        trigger={v.trigger}
        actions={v.actions}
        defaultOpen={v.defaultOpen}
      >
        <div className={v.variant === 'panel' ? 'p-2' : undefined}>
          <FilterRows rows={STATUS} />
        </div>
      </Collapsible>
    </div>
  ),
});
