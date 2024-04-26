import { useCallback, useState } from 'react';
import { AdminStats, Filters } from '@/components/admin/AdminStats';
import { authenticated } from '@/components/authenticated-container';
import { Page } from '@/components/common';
import { Checkbox } from '@/components/ui/checkbox';
import { DateRangePicker, presetLast7Days } from '@/components/ui/date-range-picker';
import { Tooltip } from '@/components/v2/tooltip';
import { useDateRangeController } from '@/lib/hooks/use-date-range-controller';

type FilterKey = keyof Filters;

const CHECKBOXES: { value: FilterKey; label: string; tooltip?: string }[] = [
  { value: 'with-projects', label: 'With Projects' },
  { value: 'with-targets', label: 'With Targets' },
  { value: 'with-schema-pushes', label: 'With Schema Pushes' },
  { value: 'with-persisted', label: 'With Persisted' },
  { value: 'with-collected', label: 'With Collected' },
];

function Manage() {
  const dateRangeController = useDateRangeController({
    dataRetentionInDays: 365,
    defaultPreset: presetLast7Days,
  });
  const [filters, setFilters] = useState<Filters>({});
  const onFiltersChange = useCallback(
    (keys: FilterKey[]) => {
      const newFilters: {
        [key in FilterKey]: boolean;
      } = {
        'with-collected': false,
        'with-schema-pushes': false,
        'with-persisted': false,
        'with-projects': false,
        'with-targets': false,
      };

      for (const key of keys) {
        newFilters[key] = true;
      }

      setFilters(newFilters);
    },
    [setFilters, filters],
  );

  return (
    <Page title="Hive Stats" className="mt-[84px]">
      <div className="grow overflow-x-auto">
        <div className="flex gap-4 pb-2">
          <DateRangePicker
            validUnits={['y', 'M', 'w', 'd', 'h', 'm']}
            selectedRange={dateRangeController.selectedPreset.range}
            startDate={dateRangeController.startDate}
            align="end"
            onUpdate={args => dateRangeController.setSelectedPreset(args.preset)}
          />
          <Tooltip.Provider delayDuration={200}>
            {CHECKBOXES.map(({ value, label, tooltip }) => (
              <span className="flex items-center gap-2" key={value}>
                <Checkbox
                  onCheckedChange={isChecked => {
                    const newFilters = {
                      ...filters,
                      [value]: isChecked,
                    };

                    return onFiltersChange(
                      Object.entries(newFilters)
                        .filter(([, v]) => v)
                        .map(([k]) => k) as any,
                    );
                  }}
                  checked={filters[value]}
                  id={value}
                />
                {tooltip ? (
                  <Tooltip content={tooltip}>
                    <label htmlFor={value} className="cursor-pointer">
                      {label}
                    </label>
                  </Tooltip>
                ) : (
                  <label htmlFor={value} className="cursor-pointer">
                    {label}
                  </label>
                )}
              </span>
            ))}
          </Tooltip.Provider>
        </div>
        <AdminStats
          resolution={dateRangeController.resolution}
          dateRange={dateRangeController.resolvedRange}
          filters={filters}
        />
      </div>
    </Page>
  );
}

export default authenticated(Manage);
