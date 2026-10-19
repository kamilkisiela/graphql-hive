import { useState } from 'react';
import { AlertTriangle, Check, GitCompare } from 'lucide-react';
import { controlsFor, createPreview, type NavPath } from 'react-foundry';
import { Select } from '../primitives/floating/select/select';
import { Tooltip } from '../primitives/floating/tooltip/tooltip';
import { ScopeBar } from './scope-bar';

export const nav: NavPath = 'Components/ScopeBar';

type Status = 'failed' | 'changed' | 'ok';

const STATUS_LABEL: Record<Status, string> = {
  failed: 'Composition failed.',
  changed: 'Schema changed',
  ok: 'Composition succeeded.',
};

function StatusGlyph({ status }: { status: Status }) {
  if (status === 'failed') return <AlertTriangle className="size-3.5 shrink-0 text-critical" />;
  if (status === 'changed') return <GitCompare className="size-3.5 shrink-0" />;
  return <Check className="size-3.5 shrink-0 text-success" />;
}

const STATUS_STATE: Record<Status, string> = {
  failed: 'Failed',
  changed: 'Schema changed',
  ok: 'No changes',
};

function statusTooltip(status: Status) {
  return (
    <Tooltip
      trigger={
        <span className="inline-flex">
          <StatusGlyph status={status} />
        </span>
      }
      content={STATUS_LABEL[status]}
    />
  );
}

/** A picker row's status as the pages build it: glyph and state in words, the reason on hover. */
function statusTrailing(status: Status) {
  return (
    <Tooltip
      trigger={
        <span className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
          <StatusGlyph status={status} />
          {STATUS_STATE[status]}
        </span>
      }
      content={STATUS_LABEL[status]}
    />
  );
}

const CHECK_CONTRACTS: Array<{ value: string; label: string; status: Status }> = [
  { value: 'default', label: 'Default Graph', status: 'failed' },
  { value: 'public-api', label: 'public-api', status: 'changed' },
  { value: 'partner-api', label: 'partner-api', status: 'ok' },
  { value: 'mobile', label: 'mobile', status: 'failed' },
];

export const Default = createPreview(() => {
  const [value, setValue] = useState('default');
  return (
    <ScopeBar
      picker={
        <Select
          aria-label="Contract"
          options={CHECK_CONTRACTS.map(entry => ({
            value: entry.value,
            label: entry.label,
            trailing: statusTrailing(entry.status),
          }))}
          value={value}
          onValueChange={setValue}
          size="compact"
          width="auto"
        />
      }
    />
  );
});

const VERSION_CONTRACTS: Array<{ value: string; label: string; status: Status }> = [
  { value: 'default', label: 'Default Graph', status: 'failed' },
  { value: '2ef369a3', label: 'adsafdsfsdfsf@2ef369a3', status: 'failed' },
  { value: 'e266be2b', label: 'gfhjghjghj@e266be2b', status: 'failed' },
  { value: 'ca1ba971', label: 'sdfasf@ca1ba971', status: 'failed' },
];

/** Contract versions as name@id. */
export const VersionPage = createPreview(() => {
  const [value, setValue] = useState('default');
  const picked = VERSION_CONTRACTS.find(entry => entry.value === value) ?? VERSION_CONTRACTS[0];
  return (
    <ScopeBar
      picker={
        <Select
          aria-label="Contract version"
          value={value}
          onValueChange={setValue}
          label={
            <span className="inline-flex items-center gap-1.5">
              <StatusGlyph status={picked.status} />
              {picked.label}
            </span>
          }
          options={VERSION_CONTRACTS.map(entry => ({
            value: entry.value,
            label: entry.label,
            trailing: statusTrailing(entry.status),
          }))}
          size="compact"
          width="auto"
        />
      }
    />
  );
});

/** No contracts, so nothing to pick. */
export const NoContracts = createPreview(() => (
  <ScopeBar
    picker={
      <span className="inline-flex items-center gap-1.5 px-2 text-xs text-fg-default">
        {statusTooltip('ok')}
        Default Graph
      </span>
    }
  />
));

export const Playground = createPreview({
  controls: controlsFor(ScopeBar, {
    label: { type: 'text', default: 'Viewing' },
  }),
  render: v => (
    <ScopeBar
      label={v.label}
      picker={
        <Select
          aria-label="Contract"
          options={[{ value: 'default', label: 'Default Graph' }]}
          value="default"
          size="compact"
          width="auto"
        />
      }
    />
  ),
});
