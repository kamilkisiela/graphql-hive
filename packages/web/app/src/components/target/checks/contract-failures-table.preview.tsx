import { useState } from 'react';
import { createPreview, type NavPath } from 'react-foundry';
import { formatCount } from '@/lib/utils';
import { ContractFailuresTable } from './contract-failures-table';

export const nav: NavPath = 'Components/ContractFailures';

const CHECK_FAILURES = [
  {
    key: 'mobile',
    label: 'mobile',
    reason: 'Composition failed.',
    detail: formatCount(2, 'error'),
  },
  {
    key: 'billing',
    label: 'billing',
    reason: 'Unapproved breaking changes!',
    detail: formatCount(1, 'breaking change'),
  },
  {
    key: 'partner-api',
    label: 'partner-api',
    reason: 'Baseline composition failed.',
    detail: formatCount(3, 'error'),
  },
];

export const Default = createPreview(() => {
  const [viewing, setViewing] = useState<string | null>(null);
  return (
    <div className="flex w-[56rem] flex-col gap-3">
      <ContractFailuresTable
        title="3 of 11 contracts failed"
        aside="8 passed"
        items={CHECK_FAILURES.map(item => ({ ...item, onView: () => setViewing(item.key) }))}
      />
      <p className="text-xs text-fg-secondary">
        {viewing ? `Scoped to ${viewing}` : 'Nothing picked yet'}
      </p>
    </div>
  );
});

export const Versions = createPreview(() => (
  <div className="w-[56rem]">
    <ContractFailuresTable
      title="1 of 11 contracts failed"
      aside="10 passed"
      items={[
        {
          key: 'billing',
          label: 'billing@9e0f1a2b',
          reason: 'Contract composition failed.',
          detail: formatCount(3, 'error'),
          onView: () => {},
        },
      ]}
    />
  </div>
));

export const Many = createPreview(() => (
  <div className="w-[56rem]">
    <ContractFailuresTable
      title="6 of 11 contracts failed"
      aside="5 passed"
      items={[
        'mobile',
        'billing',
        'partner-api-for-the-european-reseller-network',
        'checkout',
        'analytics',
        'legacy-web',
      ].map((name, index) => ({
        key: name,
        label: name,
        reason: index % 2 ? 'Unapproved breaking changes!' : 'Composition failed.',
        detail: index % 2 ? formatCount(index, 'breaking change') : formatCount(index + 1, 'error'),
        onView: () => {},
      }))}
    />
  </div>
));

export const WithoutView = createPreview(() => (
  <div className="w-[56rem]">
    <ContractFailuresTable title="3 of 11 contracts failed" items={CHECK_FAILURES} />
  </div>
));
