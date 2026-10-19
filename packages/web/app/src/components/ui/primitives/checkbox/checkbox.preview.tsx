import { useState } from 'react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Checkbox } from './checkbox';
import * as styles from './checkbox.preview.css';

export const nav: NavPath = 'Primitives/FormControls/Checkbox';

const TARGETS = ['production', 'staging', 'development'];

export const Sizes = createPreview(() => (
  <div className={styles.div}>
    <Checkbox size="sm" defaultChecked />
    <Checkbox size="md" defaultChecked />
  </div>
));

export const States = createPreview(() => (
  <div className={styles.div2}>
    <label className={styles.label}>
      <Checkbox />
      Unchecked
    </label>
    <label className={styles.label2}>
      <Checkbox defaultChecked />
      Checked
    </label>
    <label className={styles.label3}>
      <Checkbox indeterminate />
      Indeterminate
    </label>
    <label className={styles.label4}>
      <Checkbox disabled />
      Disabled
    </label>
    <label className={styles.label5}>
      <Checkbox disabled defaultChecked />
      Disabled, checked
    </label>
  </div>
));

/** `visual` renders a non-interactive indicator: tabIndex -1, aria-hidden, default cursor. */
export const Visual = createPreview(() => (
  <div className={styles.div3}>
    <Checkbox visual defaultChecked />
    <Checkbox visual />
  </div>
));

export const SelectAll = createPreview(() => {
  const [selected, setSelected] = useState<string[]>(['production']);
  const allChecked = selected.length === TARGETS.length;

  return (
    <div className={styles.div4}>
      <label className={styles.label6}>
        <Checkbox
          checked={allChecked}
          indeterminate={selected.length > 0 && !allChecked}
          onCheckedChange={checked => setSelected(checked ? TARGETS : [])}
        />
        All targets
      </label>
      {TARGETS.map(target => (
        <label key={target} className={styles.label7}>
          <Checkbox
            checked={selected.includes(target)}
            onCheckedChange={checked =>
              setSelected(prev =>
                checked ? [...prev, target] : prev.filter(item => item !== target),
              )
            }
          />
          {target}
        </label>
      ))}
    </div>
  );
});

export const Playground = createPreview({
  controls: controlsFor(Checkbox, {
    size: { type: 'radio', options: ['sm', 'md'], default: 'md' },
    checked: { type: 'boolean', default: true },
    indeterminate: { type: 'boolean', default: false },
    disabled: { type: 'boolean', default: false },
  }),
  render: v => (
    <Checkbox
      size={v.size}
      checked={v.checked}
      indeterminate={v.indeterminate}
      disabled={v.disabled}
    />
  ),
});
