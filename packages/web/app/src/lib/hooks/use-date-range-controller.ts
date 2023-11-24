import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { formatISO, subHours, subMinutes } from 'date-fns';
import { subDays } from '@/lib/date-time';

function floorDate(date: Date): Date {
  const time = 1000 * 60;
  return new Date(Math.floor(date.getTime() / time) * time);
}

const DateRange = {
  '90d': {
    resolution: 90,
    label: 'Last 90 days',
  },
  '60d': {
    resolution: 60,
    label: 'Last 60 days',
  },
  '30d': {
    resolution: 60,
    label: 'Last 30 days',
  },
  '14d': {
    resolution: 60,
    label: 'Last 14 days',
  },
  '7d': {
    resolution: 60,
    label: 'Last 7 days',
  },
  '1d': {
    resolution: 60,
    label: 'Last 24 hours',
  },
  '1h': {
    resolution: 60,
    label: 'Last hour',
  },
};

type DateRangeKey = keyof typeof DateRange;

function isDayBasedPeriodKey<T extends DateRangeKey>(
  periodKey: T,
): periodKey is Extract<T, `${number}d`> {
  return periodKey.endsWith('d');
}

function keyToHours(key: DateRangeKey): number {
  if (isDayBasedPeriodKey(key)) {
    return parseInt(key.replace('d', ''), 10) * 24;
  }

  return parseInt(key.replace('h', ''), 10);
}

export function useDateRangeController(options: {
  dataRetentionInDays: number;
  minKey?: DateRangeKey;
}) {
  const router = useRouter();
  const [href, periodParam] = router.asPath.split('?');
  let selectedDateRangeKey: DateRangeKey =
    (new URLSearchParams(periodParam).get('period') as DateRangeKey) ?? '1d';
  const availableDateRangeOptions = useMemo<DateRangeKey[]>(() => {
    return Object.keys(DateRange).filter(key => {
      const dateRangeKey = key as DateRangeKey;

      if (options.minKey && keyToHours(dateRangeKey) < keyToHours(options.minKey)) {
        return false;
      }

      if (isDayBasedPeriodKey(dateRangeKey)) {
        // Only show day based periods that are within the data retention period
        const daysBack = parseInt(dateRangeKey.replace('d', ''), 10);
        return daysBack <= options.dataRetentionInDays;
      }

      return true;
    }) as DateRangeKey[];
  }, [options.dataRetentionInDays]);

  if (!availableDateRangeOptions.includes(selectedDateRangeKey)) {
    selectedDateRangeKey = options.minKey ?? '1d';
  }

  const dateRange = useMemo(() => {
    const now = floorDate(new Date());
    const sub = selectedDateRangeKey.endsWith('h')
      ? 'h'
      : selectedDateRangeKey.endsWith('m')
        ? 'm'
        : 'd';

    const value = parseInt(selectedDateRangeKey.replace(sub, ''));
    const from = formatISO(
      sub === 'h'
        ? subHours(now, value)
        : sub === 'm'
          ? subMinutes(now, value)
          : subDays(now, value),
    );
    const to = formatISO(now);

    return { from, to };
  }, [selectedDateRangeKey, availableDateRangeOptions]);

  const updateDateRangeByKey = useCallback(
    (value: string) => {
      void router.push(`${href}?period=${value}`);
    },
    [href, router],
  );

  const displayDateRangeLabel = useCallback((key: DateRangeKey) => {
    return DateRange[key].label;
  }, []);

  return {
    dateRange,
    resolution: DateRange[selectedDateRangeKey].resolution,
    dateRangeKey: selectedDateRangeKey,
    availableDateRangeOptions,
    updateDateRangeByKey,
    displayDateRangeLabel,
  };
}
