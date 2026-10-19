import { useState } from 'react';
import { CircleMinus, CircleX, TriangleAlert } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { ToggleGroup } from './toggle-group';
import * as styles from './toggle-group.preview.css';

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
    <div className={styles.div}>
      <span className={styles.span}>Query</span>
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
        <CircleMinus
          className={`${styles.circleMinus} ${value === 'off' ? styles.circleMinus2 : styles.circleMinus3}`}
        />
      ),
    },
    {
      value: 'warning',
      tooltip: 'Warning',
      label: (
        <TriangleAlert
          className={`${styles.triangleAlert} ${value === 'warning' ? styles.triangleAlert2 : styles.triangleAlert3}`}
        />
      ),
    },
    {
      value: 'error',
      tooltip: 'Error',
      label: (
        <CircleX
          className={`${styles.circleX} ${value === 'error' ? styles.circleX2 : styles.circleX3}`}
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
    <div className={styles.div2}>
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
    <div className={styles.div3}>
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
    <div className={styles.div4}>
      <div className={styles.div5}>
        <span className={styles.span2}>A card</span>
        {pair}
      </div>
      <div className={styles.div6}>
        <span className={styles.span3}>A floating panel</span>
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
