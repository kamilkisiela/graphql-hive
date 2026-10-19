import { useState } from 'react';
import { Eraser } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Button } from '../button/button';
import { Checkbox } from '../checkbox/checkbox';
import { ScrollArea } from '../scroll-area/scroll-area';
import { Separator } from '../separator/separator';
import { Collapsible } from './collapsible';
import * as styles from './collapsible.preview.css';

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
  return (
    <ul className={styles.filterRowsUl}>
      {props.rows.map(row => (
        <li key={row.label}>
          <button type="button" className={styles.filterRowsButton}>
            <span className={styles.filterRowsSpan}>
              <Checkbox visual checked={row.label === 'ok'} size="sm" />
              {row.label}
            </span>
            <span className={styles.filterRowsSpan2}>{row.count}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * `section`: a heading row that toggles the list beneath it, as in the traces filter column.
 * The count at the trailing edge is an `actions` slot, outside the button.
 */
export const Section = createPreview(() => (
  <div className={styles.div}>
    <div className={styles.div2}>
      <Collapsible trigger="Status" defaultOpen actions={<span className={styles.span}>1</span>}>
        <FilterRows rows={STATUS} />
      </Collapsible>
    </div>
    <Separator />
    <div className={styles.div3}>
      <Collapsible trigger="Error Code">
        <FilterRows rows={ERROR_CODES} />
      </Collapsible>
    </div>
  </div>
));

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

/**
 * `panel`: the header bar of a titled panel, as in the laboratory's preflight logs. The clear
 * button is an `actions` slot and shows only while open. The panel's own content decides how
 * it scrolls: here a `fill` ScrollArea inside a wrapper with a max height.
 */
export const Panel = createPreview(() => {
  const [open, setOpen] = useState(true);
  return (
    <div className={styles.div4}>
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
          <div className={styles.div5}>
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
    <div className={styles.div6}>
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
      options: ['none', 'count', 'clear'],
      default: 'count',
      derive: kind =>
        kind === 'count' ? (
          <span className={styles.span2}>1</span>
        ) : kind === 'clear' ? (
          <Button layout="iconOnly" icon={Eraser} aria-label="Clear" variant="ghost" />
        ) : undefined,
    },
    defaultOpen: { type: 'boolean', default: true },
  }),
  render: v => (
    <div className={v.variant === 'panel' ? styles.div7 : styles.div8}>
      {/* `defaultOpen` is read once at mount, so the key remounts on a change. */}
      <Collapsible
        key={String(v.defaultOpen)}
        variant={v.variant}
        trigger={v.trigger}
        actions={v.actions}
        defaultOpen={v.defaultOpen}
      >
        <div className={v.variant === 'panel' ? styles.div9 : undefined}>
          <FilterRows rows={STATUS} />
        </div>
      </Collapsible>
    </div>
  ),
});
