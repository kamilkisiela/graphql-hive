import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { RadioGroup } from './radio-group';
import * as styles from './radio-group.preview.css';

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
              <span className={styles.span} />
              Breaking
            </>
          ),
        },
        {
          value: 'dangerous',
          content: (
            <>
              <span className={styles.span2} />
              Dangerous
            </>
          ),
        },
        {
          value: 'safe',
          content: (
            <>
              <span className={styles.span3} />
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
    <div className={styles.div}>
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
    <div className={styles.div2}>
      <div className={styles.div3}>
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
    <div className={styles.div4}>
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
      <div className={v.onSurface === 'raised' ? styles.div5 : styles.div6}>
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

function PlanBody(props: {
  name: string;
  price: string;
  description: string;
  features: string[];
  isCurrent?: boolean;
  footer?: ReactNode;
}) {
  return (
    <div className={styles.planBodyDiv}>
      <div>
        <div className={styles.planBodyDiv2}>
          <span className={styles.planBodySpan}>{props.name}</span>
          {props.isCurrent ? <span className={styles.planBodySpan2}>CURRENT PLAN</span> : null}
        </div>
        <div className={styles.planBodyDiv3}>{props.price}</div>
        <div className={styles.planBodyDiv4}>{props.description}</div>
        <div className={styles.planBodyDiv5}>
          {props.features.map(feature => (
            <div key={feature} className={styles.planBodyDiv6}>
              <Check className={styles.planBodyCheck} />
              {feature}
            </div>
          ))}
        </div>
      </div>
      {props.footer ? (
        <div>
          <div className={styles.planBodyDiv7} />
          <div className={styles.planBodyDiv8}>{props.footer}</div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * `content` carrying a whole card body, which is what the billing plan picker needs: no radio dot,
 * selection shown by the card border alone. Three cards in a row also exercise equal-height stretch.
 */
export const PlanCards = createPreview(() => {
  const [value, setValue] = useState('pro');

  return (
    <div className={styles.div7}>
      <RadioGroup
        variant="as-card"
        orientation="horizontal"
        value={value}
        onValueChange={setValue}
        items={[
          {
            value: 'hobby',
            content: (
              <PlanBody
                isCurrent
                name="Hobby"
                price="Free"
                description="For personal or small projects"
                features={[
                  'Unlimited seats, projects and organizations',
                  'Unlimited schema pushes & checks',
                  'Full access to all features (including SSO)',
                  'Limit of 1M operations per month',
                  '7 days of usage data retention',
                ]}
              />
            ),
          },
          {
            value: 'pro',
            content: (
              <PlanBody
                name="Pro"
                price="$10"
                description="For scaling APIs and teams"
                features={[
                  '+ $10 per 1M operations',
                  'Change your plan at any time',
                  'Everything in Hobby plan, and:',
                  '90 days of usage data retention',
                ]}
                footer={<span className={styles.span4}>Free 30 days trial period</span>}
              />
            ),
          },
          {
            value: 'enterprise',
            content: (
              <PlanBody
                name="Enterprise"
                price="Contact Us"
                description="Custom plan for large companies"
                features={[
                  'Unlimited seats',
                  'Unlimited operations',
                  'Unlimited schema pushes',
                  'Change your plan at any time',
                  'Improved pricing as you scale',
                  '12 months of usage data retention',
                ]}
                footer="Shape a custom plan for your business"
              />
            ),
          },
        ]}
      />
    </div>
  );
});
