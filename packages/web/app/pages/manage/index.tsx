import { useCallback, useMemo, useState } from 'react';
import { startOfMonth, subHours } from 'date-fns';
import { AdminStats, Filters } from '@/components/admin/AdminStats';
import { authenticated } from '@/components/authenticated-container';
import { Page } from '@/components/common';
import { DATE_RANGE_OPTIONS, floorToMinute } from '@/components/common/TimeFilter';
import { Checkbox as RadixCheckbox, RadixSelect, Tooltip } from '@/components/v2';
import { subDays } from '@/lib/date-time';

type DateRangeOptions = Exclude<(typeof DATE_RANGE_OPTIONS)[number], { key: 'all' }>;

function isNotAllOption(option: (typeof DATE_RANGE_OPTIONS)[number]): option is DateRangeOptions {
  return option.key !== 'all';
}

const dateRangeOptions = DATE_RANGE_OPTIONS.filter(isNotAllOption);

type FilterKey = keyof Filters;

const CHECKBOXES: { value: FilterKey; label: string; tooltip?: string }[] = [
  { value: 'with-projects', label: 'With Projects' },
  { value: 'with-targets', label: 'With Targets' },
  { value: 'with-schema-pushes', label: 'With Schema Pushes' },
  { value: 'with-persisted', label: 'With Persisted' },
  { value: 'with-collected', label: 'With Collected' },
];

function Manage() {
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeOptions['key']>('30d');
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

  const dateRange = useMemo(() => {
    const to = floorToMinute(new Date());

    if (dateRangeKey === 'month') {
      return {
        from: startOfMonth(new Date()),
        to,
      };
    }

    const unit = dateRangeKey.endsWith('d') ? 'd' : 'h';
    const value = parseInt(dateRangeKey.replace(unit, ''));

    return {
      from: unit === 'd' ? subDays(to, value) : subHours(to, value),
      to,
    };
  }, [dateRangeKey]);

  return (
    <Page title="Hive Stats" className="mt-[84px]">
      <div className="grow overflow-x-auto">
        <div className="flex gap-4 pb-2">
          <Tooltip.Provider delayDuration={200}>
            <Tooltip content="Date filter applies only to collected operations data">
              <div>
                <RadixSelect
                  defaultValue={dateRangeKey}
                  onChange={setDateRangeKey}
                  options={dateRangeOptions.map(({ key, label }) => ({ value: key, label }))}
                />
              </div>
            </Tooltip>
            {CHECKBOXES.map(({ value, label, tooltip }) => (
              <span className="flex items-center gap-2" key={value}>
                <RadixCheckbox
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
        <AdminStats dateRange={dateRange} filters={filters} />
      </div>
    </Page>
  );
}

export default authenticated(Manage);
