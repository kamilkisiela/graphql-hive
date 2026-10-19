import { useState } from 'react';
import { createPreview, type NavPath } from 'react-foundry';
import { useTheme } from '@/components/theme/theme-provider';
import { Badge } from './badge/badge';
import { Button } from './button/button';
import { Card } from './card/card';
import { Select, type SelectOption } from './floating/select/select';
import { Input } from './input/input';
import { Dialog } from './overlays/dialog/dialog';
import { StatusDot } from './status-dot/status-dot';
import { ToggleGroup } from './toggle-group/toggle-group';
import * as styles from './semantic-colors.preview.css';

export const nav: NavPath = 'Primitives/Foundations/SemanticColors';

/** A tinted pill is `bg-<state>-tint text-<state>-text`, a dot is `bg-<state>`, a hover is `-muted`. */
const STATES = [
  {
    name: 'success',
    solid: 'bg-success',
    steps: [
      'bg-success-muted',
      'bg-success-tint-strong',
      'bg-success-tint',
      'bg-success-tint-subtle',
    ],
    text: 'text-success',
    textOnTint: 'text-success-text',
    use: 'a check passed, a version is valid, a permission is allowed',
  },
  {
    name: 'warning',
    solid: 'bg-warning',
    steps: [
      'bg-warning-muted',
      'bg-warning-tint-strong',
      'bg-warning-tint',
      'bg-warning-tint-subtle',
    ],
    text: 'text-warning',
    textOnTint: 'text-warning-text',
    use: 'allowed with a caveat, a warning-level alert',
  },
  {
    name: 'critical',
    solid: 'bg-critical',
    steps: [
      'bg-critical-muted',
      'bg-critical-tint-strong',
      'bg-critical-tint',
      'bg-critical-tint-subtle',
    ],
    text: 'text-critical',
    textOnTint: 'text-critical-text',
    use: 'a failed check, a denied permission, an error',
  },
  {
    name: 'info',
    solid: 'bg-info',
    steps: ['bg-info-muted', 'bg-info-tint-strong', 'bg-info-tint', 'bg-info-tint-subtle'],
    text: 'text-info',
    textOnTint: 'text-info-text',
    use: 'an info-level alert, a neutral note',
  },
] as const;

const STEP_LABELS = ['', 'muted', 'tint-strong', 'tint', 'tint-subtle'];

export const Tokens = createPreview(() => (
  <div className={styles.div}>
    {STATES.map(state => (
      <div key={state.name} className={styles.div2}>
        <div className={styles.div3}>{state.name}</div>
        <div className={styles.div4}>
          <div className={styles.div5}>
            {[state.solid, ...state.steps].map((cls, index) => (
              <div key={cls} className={styles.div6}>
                <div className={`${styles.div7} ${cls}`} />
                <span className={styles.span}>{STEP_LABELS[index] || 'solid'}</span>
              </div>
            ))}
          </div>
          <span className={`${state.text} ${styles.span2}`}>Aa</span>
          <span className={`${state.textOnTint} ${state.steps[2]} ${styles.span3}`}>
            -text on tint
          </span>
          <span className={styles.span4}>{state.use}</span>
        </div>
      </div>
    ))}
  </div>
));

const SURFACES = [
  { token: 'surface-page', cls: 'bg-surface-page', light: 3, dark: 2 },
  { token: 'surface-card', cls: 'bg-surface-card', light: 2, dark: 3 },
  { token: 'surface-card-hover', cls: 'bg-surface-card-hover', light: 1, dark: 4 },
  { token: 'surface-overlay', cls: 'bg-surface-overlay', light: 3, dark: 3 },
  { token: 'surface-floating', cls: 'bg-surface-floating', light: 2, dark: 4 },
  { token: 'surface-control', cls: 'bg-surface-control', light: 2, dark: 3 },
  { token: 'surface-control-raised', cls: 'bg-surface-control-raised', light: 1, dark: 5 },
  { token: 'surface-selected', cls: 'bg-surface-selected', light: 5, dark: 5 },
  { token: 'surface-inverse', cls: 'bg-surface-inverse', light: 12, dark: 12 },
  { token: 'surface-hover', cls: 'bg-surface-hover', light: 4, dark: 4 },
  { token: 'surface-pressed', cls: 'bg-surface-pressed', light: 3, dark: 5 },
  { token: 'surface-inset', cls: 'bg-surface-inset', light: 1, dark: 2 },
  { token: 'surface-code', cls: 'bg-surface-code', light: 5, dark: 5 },
  { token: 'surface-skeleton', cls: 'bg-surface-skeleton', light: 5, dark: 5 },
  { token: 'surface-stripe', cls: 'bg-surface-stripe', light: 2, dark: 3 },
];

const FOREGROUNDS = [
  { token: 'fg', cls: 'text-fg', step: 12 },
  { token: 'fg-default', cls: 'text-fg-default', step: 11 },
  { token: 'fg-secondary', cls: 'text-fg-secondary', step: 10 },
  { token: 'fg-muted', cls: 'text-fg-muted', step: 9 },
  { token: 'fg-subtle', cls: 'text-fg-subtle', step: 8 },
];

const LINES = [
  { token: 'line', cls: 'border-line', light: 5, dark: 5 },
  { token: 'line-subtle', cls: 'border-line-subtle', light: 4, dark: 4 },
  { token: 'line-strong', cls: 'border-line-strong', light: 6, dark: 6 },
  { token: 'line-control', cls: 'border-line-control', light: 5, dark: 4 },
];

function useStep() {
  const { resolvedTheme } = useTheme();
  return {
    theme: resolvedTheme,
    step: (role: { light: number; dark: number }) => `n${role[resolvedTheme]}`,
  };
}

/** `nN` is the neutral step each role resolves to in the current theme. */
export const Roles = createPreview(() => {
  const { theme, step } = useStep();
  return (
    <div className={styles.div8}>
      <div className={styles.div9}>{theme}</div>
      <div className={styles.div10}>
        {SURFACES.map(role => (
          <div key={role.token} className={styles.div11}>
            <div className={`${styles.div12} ${role.cls}`} />
            <span className={styles.span5}>{role.token}</span>
            <span className={styles.span6}>{step(role)}</span>
          </div>
        ))}
      </div>
      <div className={styles.div13}>
        {FOREGROUNDS.map(role => (
          <div key={role.token} className={styles.div14}>
            <span className={`${role.cls} ${styles.span7}`}>The schema check passed</span>
            <span className={styles.span8}>
              {role.token} n{role.step}
            </span>
          </div>
        ))}
        <div className={styles.div15}>fg-inverse on surface-inverse</div>
      </div>
      <div className={styles.div16}>
        {LINES.map(role => (
          <div key={role.token} className={styles.div17}>
            <div className={`${styles.div18} ${role.cls}`} />
            <span className={styles.span9}>{role.token}</span>
            <span className={styles.span10}>{step(role)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

export const SurfaceNesting = createPreview(() => (
  <div className={styles.div19}>
    <div className={styles.div20}>
      <span className={styles.span11}>surface-card</span>
      <div className={styles.div21}>surface-control</div>
    </div>
    <div className={styles.div22}>
      <span className={styles.span12}>surface-overlay</span>
      <div className={styles.div23}>surface-control-raised</div>
      <div className={styles.div24}>
        <span className={styles.span13}>surface-floating</span>
        <span className={styles.span14}>surface-selected</span>
      </div>
    </div>
  </div>
));

/** Every raised control on surface-overlay; all four should rest on the same fill and border. */
export const RaisedControls = createPreview(() => {
  const [metric, setMetric] = useState('TRAFFIC');
  const [mode, setMode] = useState('api');
  return (
    <div className={styles.div25}>
      <Input onSurface="raised" placeholder="Input" />
      <Select options={METRICS} value={metric} onValueChange={setMetric} onSurface="raised" />
      <div className={styles.div26}>
        <Button onSurface="raised">Button</Button>
        <ToggleGroup
          options={[
            { value: 'api', label: 'API' },
            { value: 'mock', label: 'Mock' },
          ]}
          value={mode}
          onValueChange={setMode}
          onSurface="raised"
          aria-label="Mode"
        />
      </div>
    </div>
  );
});

const METRICS: SelectOption[] = [
  { value: 'TRAFFIC', label: 'Total requests' },
  { value: 'LATENCY:p99', label: 'p99 latency' },
];

/** Real components on the page and on a raised card; a raised card takes raised controls. */
export const OnThePage = createPreview(() => {
  const [metric, setMetric] = useState('TRAFFIC');
  return (
    <div className={styles.div27}>
      <Card title="This is a card on the page" description="Base card: line border, no fill.">
        <div className={styles.div28}>
          <Input placeholder="Input on surface-control" />
          <Select options={METRICS} value={metric} onValueChange={setMetric} />
        </div>
      </Card>
      <Card
        variants={{ onSurface: 'raised' }}
        title="This is a card on a raised surface"
        description="Raised card: surface-card fill, line-subtle border."
      >
        <div className={styles.div29}>
          <Input onSurface="raised" placeholder="Input on surface-control-raised" />
          <Select options={METRICS} value={metric} onValueChange={setMetric} onSurface="raised" />
          <p className={styles.p}>
            fg-muted body with <code className={styles.code}>surface-code</code>
          </p>
        </div>
      </Card>
    </div>
  );
});

/** Opens from a button so the overlay, its backdrop and the floating popup render for real. */
export const InAnOverlay = createPreview(() => {
  const [metric, setMetric] = useState('TRAFFIC');
  return (
    <Dialog
      trigger={<Button variant="primary">Open dialog</Button>}
      title="This is a dialog on surface-overlay"
      description="Every control in here takes onSurface raised."
      footer={<Button onSurface="raised">Cancel</Button>}
    >
      <div className={styles.div30}>
        <Input onSurface="raised" placeholder="Input on surface-control-raised" />
        <Select options={METRICS} value={metric} onValueChange={setMetric} onSurface="raised" />
      </div>
    </Dialog>
  );
});

/** The same four states as the components that carry them. */
export const InComponents = createPreview(() => (
  <div className={styles.div31}>
    {STATES.map(state => (
      <div key={state.name} className={styles.div32}>
        <span className={styles.span15}>{state.name}</span>
        <StatusDot color={state.name} />
        <Badge content={state.name} variants={{ variant: state.name }} />
        <Badge content={state.name} variants={{ variant: state.name, size: 'sm', mono: true }} />
      </div>
    ))}
  </div>
));
