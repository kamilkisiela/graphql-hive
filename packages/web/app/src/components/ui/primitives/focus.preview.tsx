import { useState } from 'react';
import { Copy } from 'lucide-react';
import { createPreview, type NavPath } from 'react-foundry';
import { Button } from './button/button';
import { Card } from './card/card';
import { Checkbox } from './checkbox/checkbox';
import { Select } from './floating/select/select';
import { Input } from './input/input';
import { Switch } from './switch/switch';
import { Tabs } from './tabs/tabs';

export const nav: NavPath = 'Primitives/Foundations/Focus';

/**
 * Keyboard focus, two treatments by shape. A control with an edge gets a 2px accent outline, 2px
 * off the edge. Text on the page, a tab or a navigation link, gets a quiet one: 1px dotted on a
 * small radius. Both on `:focus-visible` only, so a mouse click does not paint them but Tab does,
 * and both an `outline` rather than a box-shadow ring, because an outline needs no offset colour
 * and so reads the same on the page, on a card and inside a popover.
 *
 * Click into the frame, then Tab through. Before this, base Button had `outline-none` and nothing
 * else, so a Select trigger or a form button gave a keyboard user no sign of where they were.
 * Never put `outline-none` beside either ring: in Tailwind v4 it zeroes the variable the outline
 * utilities read, and the ring silently disappears.
 */
export const TabThrough = createPreview(() => {
  const [on, setOn] = useState(true);
  const [value, setValue] = useState('p95');
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary">Save alert</Button>
        <Button variant="outline">Cancel</Button>
        <Button variant="ghost">Skip</Button>
        <Button variant="destructive">Delete</Button>
        <Button label="Last 7 days" />
        <Button layout="iconOnly" icon={Copy} aria-label="Copy" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          options={[
            { value: 'p50', label: 'p50 latency' },
            { value: 'p95', label: 'p95 latency' },
          ]}
          value={value}
          onValueChange={setValue}
        />
        <Input placeholder="Search…" />
        <Switch checked={on} onCheckedChange={setOn} aria-label="Enable" />
        <Checkbox defaultChecked aria-label="Include" />
      </div>
    </div>
  );
});

/**
 * Text on the page: the quiet ring. Tabs here; the layout bars' SecondaryNavigation links take the
 * same one. Tab into the strip, then arrow along it.
 */
export const TextOnThePage = createPreview(() => (
  <Tabs
    items={[
      { value: 'summary', label: 'Summary', content: <p className="text-sm">Summary</p> },
      { value: 'schema', label: 'Schema', content: <p className="text-sm">Schema</p> },
      { value: 'supergraph', label: 'Supergraph', content: <p className="text-sm">Supergraph</p> },
    ]}
    defaultValue="summary"
  />
));

/** The same controls on a raised surface: the outline sits off the edge, so the fill does not matter. */
export const OnRaised = createPreview(() => (
  <div className="w-[26rem]">
    <Card variants={{ onSurface: 'raised' }}>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline">On a card</Button>
        <Button label="Raised trigger" onSurface="raised" />
        <Switch defaultChecked aria-label="Enable" />
      </div>
    </Card>
  </div>
));
