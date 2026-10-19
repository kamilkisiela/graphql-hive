import { CalendarDays, SearchIcon } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Button } from '../button/button';
import { Input } from './input';

export const nav: NavPath = 'Primitives/Input';

export const Default = createPreview(() => <Input placeholder="Enter alert name" />);

export const Types = createPreview(() => (
  <div className="flex w-72 flex-col gap-3">
    <Input placeholder="Text" />
    <Input type="number" placeholder="Threshold" />
    <Input type="email" placeholder="you@example.com" />
    <Input type="password" placeholder="Token" />
    <Input type="date" defaultValue="2026-09-01" />
  </div>
));

export const States = createPreview(() => (
  <div className="flex w-72 flex-col gap-3">
    <Input placeholder="Empty" />
    <Input defaultValue="P99 Latency Spike" />
    <Input placeholder="Disabled" disabled />
    <Input defaultValue="Disabled with value" disabled />
    <Input defaultValue="Read only" readOnly />
    <Input defaultValue="not a valid slug!" invalid />
  </div>
));

/**
 * `raised` is for a field inside a sheet, dialog or raised card. Those surfaces sit at neutral-3,
 * the same shade as the base fill in dark mode, so a base field on them has no edge to see. Click
 * into a field: focus lifts the fill one step on either surface.
 */
export const OnSurface = createPreview(() => (
  <div className="flex flex-wrap gap-6">
    <div className="flex w-80 flex-col gap-3 rounded-md bg-neutral-1 p-6">
      <Input placeholder="base, on the page" />
      <Input defaultValue="P99 Latency Spike" />
      <Input placeholder="slug" prefixText="app.graphql-hive.com/" />
    </div>
    <div className="flex w-80 flex-col gap-3 rounded-md border border-line bg-surface-overlay p-6">
      <Input placeholder="raised, in a sheet" onSurface="raised" />
      <Input defaultValue="P99 Latency Spike" onSurface="raised" />
      <Input placeholder="slug" prefixText="app.graphql-hive.com/" onSurface="raised" />
    </div>
  </div>
));

/**
 * `default` is a form field. `compact` is toolbar and filter chrome, such as the traces filter's
 * date and time fields, and matches the compact Button and Select.
 */
export const Sizes = createPreview(() => (
  <div className="flex w-72 flex-col gap-3">
    <Input placeholder="Default, 36px" />
    <Input placeholder="Compact, 30px" size="compact" />
  </div>
));

/** `full` is fluid; the other three are the fixed widths the app's fields come in. */
export const Widths = createPreview(() => (
  <div className="flex flex-col gap-3">
    <Input placeholder="full" />
    <Input placeholder="md" width="md" />
    <Input placeholder="sm" width="sm" />
    <Input placeholder="xs" width="xs" />
  </div>
));

/** A number field set inside a sentence. The input is inline by default, so no override is needed. */
export const Inline = createPreview(() => (
  <div className="flex w-[34rem] flex-wrap items-center gap-2 text-sm">
    <span>Retire an app deployment when it was created at least</span>
    <Input type="number" min="0" defaultValue="30" width="xs" />
    <span>days ago and has not been used for at least</span>
    <Input type="number" min="0" defaultValue="14" width="xs" />
    <span>days.</span>
  </div>
));

export const LeadingIcon = createPreview(() => (
  <div className="w-80">
    <Input type="search" placeholder="Search..." leadingIcon={SearchIcon} />
  </div>
));

/**
 * A fixed block attached to the leading edge. `width` sizes the field; the prefix adds its own
 * width, so a long slug path never squeezes the field.
 */
export const PrefixText = createPreview(() => (
  <div className="flex flex-col gap-3">
    <Input placeholder="slug" prefixText="app.graphql-hive.com/the-guild/" width="sm" />
    <Input placeholder="slug" prefixText="app.graphql-hive.com/the-guild/graphql-api/" />
  </div>
));

/** Something inside the trailing edge: here an icon-only button that opens a date picker. */
export const Trailing = createPreview(() => (
  <div className="w-80">
    <Input
      defaultValue="now-30d"
      mono
      trailing={
        <Button layout="iconOnly" icon={CalendarDays} aria-label="Pick a date" variant="ghost" />
      }
    />
  </div>
));

/** `mono` for a value that is an identifier or a token rather than prose. */
export const Mono = createPreview(() => (
  <div className="w-96">
    <Input readOnly mono defaultValue="hv1/8f3a11c2e4d6b9f0a7c3e1d5b2a8f4c6" />
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(Input, {
    placeholder: { type: 'text', default: 'Enter alert name' },
    type: { type: 'select', options: ['text', 'number', 'email', 'password'], default: 'text' },
    size: { type: 'radio', options: ['compact', 'default'], default: 'default' },
    onSurface: { type: 'radio', options: ['base', 'raised'], default: 'base' },
    width: { type: 'select', options: ['full', 'md', 'sm', 'xs'], default: 'full' },
    mono: { type: 'boolean', default: false },
    invalid: { type: 'boolean', default: false },
    disabled: { type: 'boolean', default: false },
  }),
  render: v => (
    <Input
      type={v.type}
      placeholder={v.placeholder}
      size={v.size}
      onSurface={v.onSurface}
      width={v.width}
      mono={v.mono}
      invalid={v.invalid}
      disabled={v.disabled}
    />
  ),
});
