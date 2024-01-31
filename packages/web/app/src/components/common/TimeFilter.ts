import { formatISO, startOfMonth, subHours, subMinutes } from 'date-fns';
import { subDays } from '@/lib/date-time';

export function floorToMinute(date: Date) {
  const time = 1000 * 60 * 1;
  return new Date(Math.floor(date.getTime() / time) * time);
}

export const DATE_RANGE_OPTIONS = [
  {
    label: 'Last 30 days',
    key: '30d' as const,
    asDays: 30,
  },
  {
    label: 'Last 14 days',
    key: '14d' as const,
    asDays: 14,
  },
  {
    label: 'Last 7 days',
    key: '7d' as const,
    asDays: 7,
  },
  {
    label: 'Last 24 hours',
    key: '1d' as const,
    asDays: 1,
  },
  {
    label: 'Last hour',
    key: '1h' as const,
  },
  {
    label: 'All-time',
    key: 'all' as const,
    asDays: 0 as const,
  },
  {
    label: 'Current month',
    key: 'month' as const,
    asDays: 0 as const,
  },
];

type KeyOf<T> =
  T extends Array<{
    key: infer K;
  }>
    ? K
    : never;

type PeriodKey = KeyOf<typeof DATE_RANGE_OPTIONS>;

export function calculatePeriod(period: PeriodKey) {
  const now = floorToMinute(new Date());
  const to = formatISO(now);

  if (period === 'all') {
    return {
      from: formatISO(subDays(now, 90)),
      to,
    };
  }

  if (period === 'month') {
    return {
      from: formatISO(startOfMonth(now)),
      to,
    };
  }

  const sub = period.endsWith('h') ? 'h' : period.endsWith('m') ? 'm' : 'd';
  const value = parseInt(period.replace(sub, ''));
  const from = formatISO(
    sub === 'h' ? subHours(now, value) : sub === 'm' ? subMinutes(now, value) : subDays(now, value),
  );

  return {
    from,
    to,
  };
}
