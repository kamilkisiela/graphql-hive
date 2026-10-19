import { useState } from 'react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Plan, planCollection } from '@/components/organization/billing/BillingPlanPicker';
import { BillingPlanType } from '@/gql/graphql';
import { StatusDot } from '../status-dot/status-dot';
import { RadioGroup } from './radio-group';

export const nav: NavPath = 'Primitives/FormControls/RadioGroup';

export const Default = createPreview(() => {
  const [value, setValue] = useState('7d');

  return (
    <RadioGroup
      variant="as-button"
      value={value}
      onValueChange={setValue}
      items={[
        { value: '1h', label: 'Last hour' },
        { value: '1d', label: 'Last day' },
        { value: '7d', label: 'Last 7 days' },
        { value: '30d', label: 'Last 30 days' },
      ]}
    />
  );
});

/** A status dot before the label is just `content`: the item cva already lays it out as a row. */
export const WithIndicators = createPreview(() => {
  const [value, setValue] = useState('all');

  return (
    <RadioGroup
      variant="as-button"
      value={value}
      onValueChange={setValue}
      items={[
        { value: 'all', label: 'All' },
        {
          value: 'breaking',
          content: (
            <>
              <StatusDot color="critical" />
              Breaking
            </>
          ),
        },
        {
          value: 'dangerous',
          content: (
            <>
              <StatusDot color="warning" />
              Dangerous
            </>
          ),
        },
        {
          value: 'safe',
          content: (
            <>
              <StatusDot color="success" />
              Safe
            </>
          ),
        },
      ]}
    />
  );
});

export const TwoOptions = createPreview(() => {
  const [value, setValue] = useState('federation');

  return (
    <RadioGroup
      variant="as-button"
      value={value}
      onValueChange={setValue}
      items={[
        { value: 'federation', label: 'Federation' },
        { value: 'single', label: 'Single schema' },
      ]}
    />
  );
});

const SEVERITY_ITEMS = [
  {
    value: 'normal',
    label: 'Normal',
    description:
      'Minor problems or general questions with little to no impact on functionality, often involving small nuisances or easily bypassed errors.',
  },
  {
    value: 'high',
    label: 'High',
    description:
      'Significant problems affecting a subset of users or workflows, with a workaround available.',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    description: 'Critical failures blocking production traffic with no available workaround.',
  },
];

/** `as-card` stacks full-width options with a real radio dot and supporting copy. */
export const AsCard = createPreview(() => {
  const [value, setValue] = useState('normal');

  return (
    <div className="w-[493px]">
      <RadioGroup
        variant="as-card"
        onSurface="base"
        value={value}
        onValueChange={setValue}
        items={SEVERITY_ITEMS}
      />
    </div>
  );
});

/** `orientation` is independent of `variant`: cards side by side, buttons stacked. */
export const Orientations = createPreview(() => {
  const [cards, setCards] = useState('normal');
  const [buttons, setButtons] = useState('7d');

  return (
    <div className="flex flex-col gap-8">
      <div className="w-[760px]">
        <RadioGroup
          variant="as-card"
          orientation="vertical"
          value={cards}
          onValueChange={setCards}
          items={SEVERITY_ITEMS}
        />
      </div>
      <RadioGroup
        variant="as-button"
        orientation="horizontal"
        value={buttons}
        onValueChange={setButtons}
        items={[
          { value: '1h', label: 'Last hour' },
          { value: '1d', label: 'Last day' },
          { value: '7d', label: 'Last 7 days' },
        ]}
      />
    </div>
  );
});

/** The same cards on a raised surface (popover, dialog), which sits a step lighter. */
export const AsCardFloating = createPreview(() => {
  const [value, setValue] = useState('high');

  return (
    <div className="w-[533px] rounded-md border border-line bg-surface-overlay p-5">
      <RadioGroup
        variant="as-card"
        onSurface="raised"
        value={value}
        onValueChange={setValue}
        items={SEVERITY_ITEMS}
      />
    </div>
  );
});

export const Playground = createPreview({
  controls: controlsFor(RadioGroup, {
    variant: { type: 'radio', options: ['as-button', 'as-card'], default: 'as-card' },
    onSurface: { type: 'radio', options: ['base', 'raised'], default: 'base' },
    orientation: { type: 'radio', options: ['vertical', 'horizontal'], default: 'vertical' },
    disabled: { type: 'boolean', default: false },
  }),
  render: v => {
    const [value, setValue] = useState('normal');
    return (
      <div
        className={
          v.onSurface === 'raised'
            ? 'w-[46rem] rounded-md border border-line bg-surface-overlay p-5'
            : 'w-[46rem]'
        }
      >
        <RadioGroup
          variant={v.variant}
          onSurface={v.onSurface}
          orientation={v.orientation}
          disabled={v.disabled}
          value={value}
          onValueChange={setValue}
          items={SEVERITY_ITEMS}
        />
      </div>
    );
  },
});

/**
 * `content` carrying a whole card body, which is what the billing plan picker needs: no radio dot,
 * selection shown by the card border alone. Three cards in a row also exercise equal-height stretch.
 */
export const PlanCards = createPreview(() => {
  const [value, setValue] = useState('pro');

  return (
    <div className="w-[62rem]">
      <RadioGroup
        variant="as-card"
        orientation="horizontal"
        value={value}
        onValueChange={setValue}
        items={[
          {
            value: 'hobby',
            content: (
              <Plan isActive name="Hobby" price="Free" {...planCollection[BillingPlanType.Hobby]} />
            ),
          },
          {
            value: 'pro',
            content: (
              <Plan
                isActive={false}
                name="Pro"
                price={10}
                {...planCollection[BillingPlanType.Pro]}
              />
            ),
          },
          {
            value: 'enterprise',
            content: (
              <Plan
                isActive={false}
                name="Enterprise"
                price="Contact Us"
                {...planCollection[BillingPlanType.Enterprise]}
              />
            ),
          },
        ]}
      />
    </div>
  );
});
