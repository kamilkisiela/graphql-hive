import { useState } from 'react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Button } from '../button/button';
import { Card } from '../card/card';
import { Menu } from '../floating/menu/menu';
import { Switch } from './switch';

export const nav: NavPath = 'Primitives/FormControls/Switch';

export const Sizes = createPreview(() => (
  <div className="flex items-center gap-6">
    <Switch size="standard" defaultChecked />
    <Switch size="small" defaultChecked />
  </div>
));

export const States = createPreview(() => (
  <div className="flex flex-col gap-4 text-control">
    <label className="flex items-center gap-3">
      <Switch />
      Off
    </label>
    <label className="flex items-center gap-3">
      <Switch defaultChecked />
      On
    </label>
    <label className="flex items-center gap-3">
      <Switch disabled />
      Disabled, off
    </label>
    <label className="flex items-center gap-3">
      <Switch disabled defaultChecked />
      Disabled, on
    </label>
  </div>
));

export const InSettingsRow = createPreview(() => {
  const [enabled, setEnabled] = useState(true);

  return (
    <div className="w-96">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-fg">Alert enabled</div>
            <div className="text-control text-fg-secondary">
              {enabled ? 'Evaluating every 5 minutes.' : 'Paused, no notifications will be sent.'}
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </Card>
    </div>
  );
});

/**
 * `decorative` is for a switch that shows state but is not itself the control: the menu row
 * around it owns the click. Not focusable, hidden from assistive tech, and the cursor is the
 * row's. Menu's `toggle` row is the one shipped user; open it and tab: the switch is skipped.
 */
export const Decorative = createPreview(() => {
  const [checked, setChecked] = useState(true);
  return (
    <Menu
      trigger={<Button label="View options" />}
      minWidth="md"
      sections={[
        [{ kind: 'toggle', label: 'Show deprecated fields', checked, onCheckedChange: setChecked }],
      ]}
    />
  );
});

export const Playground = createPreview({
  controls: controlsFor(Switch, {
    size: { type: 'radio', options: ['standard', 'small'], default: 'standard' },
    checked: { type: 'boolean', default: true },
    disabled: { type: 'boolean', default: false },
    decorative: { type: 'boolean', default: false },
  }),
  render: v => (
    <Switch size={v.size} checked={v.checked} disabled={v.disabled} decorative={v.decorative} />
  ),
});
