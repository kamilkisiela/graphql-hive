import { useState } from 'react';
import { CircleHelp, Info, ShieldAlert } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Select } from '../floating/select/select';
import { Input } from '../input/input';
import { Switch } from '../switch/switch';
import { Label } from './label';
import * as styles from './label.preview.css';

export const nav: NavPath = 'Primitives/FormControls/Label';

/**
 * A label on its own, for a control that is not inside a Form. Text only; small caps over a
 * control by default, the same look as a form label; `inline` beside a switch or a checkbox in a
 * row. A `tooltip` puts an explanation behind an icon beside it, the same slot FormLabel has.
 */

/** The CDN dialog: a label over each select, pointing at the trigger. */
export const OverAControl = createPreview(() => {
  const [graph, setGraph] = useState('DEFAULT_GRAPH');
  return (
    <div className={styles.div}>
      <div>
        <Label htmlFor="cdn-graph" label="Graph Variant" />
        <Select
          id="cdn-graph"
          options={[
            { value: 'DEFAULT_GRAPH', label: 'Default Graph' },
            { value: 'mobile', label: 'mobile' },
          ]}
          value={graph}
          onValueChange={setGraph}
          width="md"
        />
      </div>
      <div>
        <Label
          htmlFor="proposal-title"
          label="Title"
          tooltip="Shown in the proposals list and in notifications."
        />
        <Input id="proposal-title" placeholder="A title for the proposal" />
      </div>
    </div>
  );
});

/** The checks list filters: a label and a switch at each end of a row. */
export const Inline = createPreview(() => {
  const [changed, setChanged] = useState(true);
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.div2}>
      <div className={styles.div3}>
        <Label htmlFor="filter-changed" label="Show only changed schemas" variant="inline" />
        <Switch id="filter-changed" checked={changed} onCheckedChange={setChanged} />
      </div>
      <div className={styles.div4}>
        <Label htmlFor="filter-failed" label="Show only failed checks" variant="inline" />
        <Switch id="filter-failed" checked={failed} onCheckedChange={setFailed} />
      </div>
    </div>
  );
});

const ICONS = { info: Info, 'circle-help': CircleHelp, 'shield-alert': ShieldAlert };

export const Playground = createPreview({
  controls: controlsFor(Label, {
    label: { type: 'text', default: 'Graph Variant' },
    variant: { type: 'radio', options: ['caps', 'inline'], default: 'caps' },
    tooltip: {
      type: 'text',
      default: 'Shown in the proposals list and in notifications.',
      derive: text => text || undefined,
    },
    icon: {
      type: 'radio',
      options: ['info', 'circle-help', 'shield-alert'],
      default: 'info',
      derive: name => ICONS[name],
    },
  }),
  render: v => (
    <div>
      <Label
        htmlFor="playground-input"
        label={v.label}
        variant={v.variant}
        tooltip={v.tooltip}
        icon={v.icon}
      />
      <Input id="playground-input" placeholder="Type here" />
    </div>
  ),
});
