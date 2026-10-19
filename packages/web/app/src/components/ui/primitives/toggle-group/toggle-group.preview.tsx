import { useState } from 'react';
import { CircleMinus, CircleX, TriangleAlert } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { cn } from '@/lib/utils';
import { Card } from '../card/card';
import { floatingVariants } from '../floating/shared-styles';
import { ToggleGroup } from './toggle-group';

export const nav: NavPath = 'Primitives/FormControls/ToggleGroup';

const ENDPOINTS = [
  { value: 'mockApi', label: 'Mock', tooltip: 'Use Mock Schema' },
  { value: 'linkedApi', label: 'API', tooltip: 'Use API endpoint' },
];

/**
 * A segmented single-select. Exactly one option is pressed at all times: pressing it again is
 * ignored rather than clearing the group. Text options are the laboratory's Mock / API switch
 * and the policy enum pickers; the `tooltip` replaces the `title` attribute those carried.
 */
export const Text = createPreview(() => {
  const [value, setValue] = useState('mockApi');
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold">Query</span>
      <ToggleGroup options={ENDPOINTS} value={value} onValueChange={setValue} aria-label="Query" />
    </div>
  );
});

/**
 * The policy severity picker: icon-only options, each named by its tooltip. The pressed colour
 * is the call site's to compute, since it differs per option.
 */
export const IconOnly = createPreview(() => {
  const [value, setValue] = useState('warning');
  const options = [
    {
      value: 'off',
      tooltip: 'Disables a rule defined at the organization level',
      label: (
        <CircleMinus className={`size-[15px] ${value === 'off' ? 'text-fg' : 'text-fg-subtle'}`} />
      ),
    },
    {
      value: 'warning',
      tooltip: 'Warning',
      label: (
        <TriangleAlert
          className={`size-[15px] ${value === 'warning' ? 'text-warning' : 'text-fg-subtle'}`}
        />
      ),
    },
    {
      value: 'error',
      tooltip: 'Error',
      label: (
        <CircleX
          className={`size-[15px] ${value === 'error' ? 'text-critical' : 'text-fg-subtle'}`}
        />
      ),
    },
  ];
  return (
    <ToggleGroup options={options} value={value} onValueChange={setValue} aria-label="Severity" />
  );
});

/** One option disabled (the laboratory's API option when the target has no endpoint), then the whole group. */
export const Disabled = createPreview(() => {
  const [value, setValue] = useState('mockApi');
  return (
    <div className="flex items-center gap-6">
      <ToggleGroup
        options={[ENDPOINTS[0], { ...ENDPOINTS[1], disabled: true }]}
        value={value}
        onValueChange={setValue}
        aria-label="Query"
      />
      <ToggleGroup
        options={ENDPOINTS}
        value={value}
        onValueChange={setValue}
        disabled
        aria-label="Query"
      />
    </div>
  );
});

export const Sizes = createPreview(() => {
  const [value, setValue] = useState('mockApi');
  return (
    <div className="flex items-center gap-4">
      <ToggleGroup options={ENDPOINTS} value={value} onValueChange={setValue} size="compact" />
      <ToggleGroup options={ENDPOINTS} value={value} onValueChange={setValue} size="default" />
    </div>
  );
});

export const OnSurface = createPreview(() => {
  const [value, setValue] = useState('mockApi');
  const pair = (
    <>
      <ToggleGroup options={ENDPOINTS} value={value} onValueChange={setValue} />
      <ToggleGroup options={ENDPOINTS} value={value} onValueChange={setValue} onSurface="raised" />
    </>
  );
  return (
    <div className="flex flex-wrap gap-6">
      <div className="w-[20rem]">
        <Card variants={{ onSurface: 'raised' }}>
          <div className="flex flex-col items-start gap-3">
            <span className="text-xs text-fg-default">A card</span>
            {pair}
          </div>
        </Card>
      </div>
      <div
        className={cn(
          floatingVariants({ padding: 'md' }),
          'flex w-[20rem] flex-col items-start gap-3 p-4',
        )}
      >
        <span className="text-xs text-fg-default">A floating panel</span>
        {pair}
      </div>
    </div>
  );
});

export const Playground = createPreview({
  controls: controlsFor(ToggleGroup, {
    options: {
      type: 'list',
      of: {
        value: { type: 'text' },
        label: { type: 'text', default: 'Option' },
        tooltip: { type: 'text' },
        disabled: { type: 'boolean', default: false },
      },
      default: ENDPOINTS,
    },
    size: { type: 'radio', options: ['compact', 'default'], default: 'compact' },
    onSurface: { type: 'radio', options: ['base', 'raised'], default: 'base' },
    disabled: { type: 'boolean', default: false },
    'aria-label': { type: 'text', default: 'Query' },
  }),
  render: v => {
    const [value, setValue] = useState(v.options[0]?.value);
    return (
      <ToggleGroup
        options={v.options}
        value={value}
        onValueChange={setValue}
        size={v.size}
        onSurface={v.onSurface}
        disabled={v.disabled}
        aria-label={v['aria-label']}
      />
    );
  },
});
