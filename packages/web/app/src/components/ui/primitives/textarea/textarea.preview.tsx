import { useState } from 'react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Textarea } from './textarea';

export const nav: NavPath = 'Primitives/Textarea';

/** Same field as Input: fill, border, hover, focus and error states, at a minimum of 80px. */
export const Default = createPreview(() => (
  <div className="w-[28rem]">
    <Textarea placeholder="Enter a short description of your issue" />
  </div>
));

export const States = createPreview(() => (
  <div className="flex w-[28rem] flex-col gap-3">
    <Textarea defaultValue="Alerts for the checkout service." />
    <Textarea placeholder="Disabled" disabled />
    <Textarea defaultValue="Too short." invalid />
  </div>
));

/** Same ladder as Input: `raised` for a description field inside a sheet or dialog, and focus lifts the fill. */
export const OnSurface = createPreview(() => (
  <div className="flex flex-wrap gap-6">
    <div className="w-80 rounded-md bg-neutral-1 p-6">
      <Textarea placeholder="base, on the page" />
    </div>
    <div className="w-80 rounded-md border border-line bg-surface-overlay p-6">
      <Textarea placeholder="raised, in a sheet" onSurface="raised" />
    </div>
  </div>
));

/**
 * `autoSize` grows the field with its text through the native `field-sizing: content`. Where a
 * browser lacks it, the field keeps its rows and scrolls. Type a few lines here.
 */
export const AutoSize = createPreview(() => {
  const [value, setValue] = useState('');
  return (
    <div className="w-[28rem]">
      <Textarea
        autoSize
        rows={3}
        placeholder="Describe the proposed change"
        value={value}
        onChange={event => setValue(event.currentTarget.value)}
      />
    </div>
  );
});

/** Read-only, mono and auto-sized: the multi-line copy field for a generated token. */
export const ReadOnlyMono = createPreview(() => (
  <div className="w-[36rem]">
    <Textarea
      readOnly
      autoSize
      mono
      value={
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\n.eyJzdWIiOiJ0YXJnZXQ6cHJvZHVjdGlvbiJ9\n.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1g'
      }
      onFocus={event => event.target.select()}
    />
  </div>
));

export const Playground = createPreview({
  controls: controlsFor(Textarea, {
    placeholder: { type: 'text', default: 'Enter a description' },
    onSurface: { type: 'radio', options: ['base', 'raised'], default: 'base' },
    autoSize: { type: 'boolean', default: false },
    mono: { type: 'boolean', default: false },
    invalid: { type: 'boolean', default: false },
    disabled: { type: 'boolean', default: false },
  }),
  render: v => (
    <div className="w-[28rem]">
      <Textarea
        placeholder={v.placeholder}
        onSurface={v.onSurface}
        autoSize={v.autoSize}
        mono={v.mono}
        invalid={v.invalid}
        disabled={v.disabled}
      />
    </div>
  ),
});
