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
  <div className="flex flex-col gap-5">
    {STATES.map(state => (
      <div key={state.name} className="grid grid-cols-[6rem_1fr] items-center gap-4">
        <div className="font-mono text-2xs text-fg-muted">{state.name}</div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {[state.solid, ...state.steps].map((cls, index) => (
              <div key={cls} className="flex flex-col items-center gap-1">
                <div className={`size-9 rounded-sm border border-line ${cls}`} />
                <span className="font-mono text-2xs text-fg-muted">
                  {STEP_LABELS[index] || 'solid'}
                </span>
              </div>
            ))}
          </div>
          <span className={`${state.text} text-sm font-medium`}>Aa</span>
          <span className={`${state.textOnTint} ${state.steps[2]} rounded-md px-2 py-0.5 text-xs`}>
            -text on tint
          </span>
          <span className="text-2xs text-fg-muted">{state.use}</span>
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
    <div className="flex w-[28rem] flex-col gap-6">
      <div className="text-sm font-medium text-fg">{theme}</div>
      <div className="flex flex-col gap-2">
        {SURFACES.map(role => (
          <div key={role.token} className="flex items-center gap-3">
            <div className={`size-8 shrink-0 rounded-sm border border-line ${role.cls}`} />
            <span className="font-mono text-2xs text-fg-secondary">{role.token}</span>
            <span className="ml-auto font-mono text-2xs text-fg-subtle">{step(role)}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        {FOREGROUNDS.map(role => (
          <div key={role.token} className="flex items-baseline gap-3">
            <span className={`${role.cls} text-sm`}>The schema check passed</span>
            <span className="ml-auto font-mono text-2xs text-fg-subtle">
              {role.token} n{role.step}
            </span>
          </div>
        ))}
        <div className="mt-1 self-start rounded-sm bg-surface-inverse px-2 py-1 text-xs text-fg-inverse">
          fg-inverse on surface-inverse
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {LINES.map(role => (
          <div key={role.token} className="flex items-center gap-3">
            <div className={`h-6 w-16 shrink-0 rounded-sm border bg-surface-card ${role.cls}`} />
            <span className="font-mono text-2xs text-fg-secondary">{role.token}</span>
            <span className="ml-auto font-mono text-2xs text-fg-subtle">{step(role)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

/** Every raised control on surface-overlay; all four should rest on the same fill and border. */
export const RaisedControls = createPreview(() => {
  const [metric, setMetric] = useState('TRAFFIC');
  const [mode, setMode] = useState('api');
  return (
    <div className="flex w-[28rem] flex-col gap-3 bg-surface-overlay p-5">
      <Input onSurface="raised" placeholder="Input" />
      <Select options={METRICS} value={metric} onValueChange={setMetric} onSurface="raised" />
      <div className="flex items-center gap-3">
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
    <div className="grid w-[40rem] grid-cols-2 gap-4">
      <Card title="This is a card on the page" description="Base card: line border, no fill.">
        <div className="flex flex-col gap-3">
          <Input placeholder="Input on surface-control" />
          <Select options={METRICS} value={metric} onValueChange={setMetric} />
        </div>
      </Card>
      <Card
        variants={{ onSurface: 'raised' }}
        title="This is a card on a raised surface"
        description="Raised card: surface-card fill, line-subtle border."
      >
        <div className="flex flex-col gap-3">
          <Input onSurface="raised" placeholder="Input on surface-control-raised" />
          <Select options={METRICS} value={metric} onValueChange={setMetric} onSurface="raised" />
          <p className="text-sm text-fg-muted">
            fg-muted body with <code className="rounded-sm bg-surface-code px-1">surface-code</code>
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
      <div className="flex flex-col gap-3">
        <Input onSurface="raised" placeholder="Input on surface-control-raised" />
        <Select options={METRICS} value={metric} onValueChange={setMetric} onSurface="raised" />
      </div>
    </Dialog>
  );
});

/** The same four states as the components that carry them. */
export const InComponents = createPreview(() => (
  <div className="flex flex-col gap-3">
    {STATES.map(state => (
      <div key={state.name} className="flex items-center gap-4 text-sm">
        <span className="w-16 font-mono text-2xs text-fg-muted">{state.name}</span>
        <StatusDot color={state.name} />
        <Badge content={state.name} variants={{ variant: state.name }} />
        <Badge content={state.name} variants={{ variant: state.name, size: 'sm', mono: true }} />
      </div>
    ))}
  </div>
));
