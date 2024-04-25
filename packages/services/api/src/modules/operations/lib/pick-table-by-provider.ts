import {
  addMinutes,
  format,
  startOfDay,
  startOfHour,
  startOfMinute,
  subHours,
  subMinutes,
} from 'date-fns';
import type { DateRange } from '../../../shared/entities';
import type { Logger } from '../../shared/providers/logger';
import { ParsedInterval } from './interval';

// How long rows are kept in the database, per table.
const tableTTLInHours = {
  daily: 365 * 24,
  hourly: 30 * 24,
  minutely: 24,
};

function formatDate(date: Date): string {
  return format(addMinutes(date, date.getTimezoneOffset()), 'yyyy-MM-dd HH:mm:ss');
}

type Table = 'hourly' | 'daily' | 'minutely';

const tablePerformanceScore = {
  daily: 3,
  hourly: 2,
  minutely: 1,
};

/** pick the correct materialized view table for request data based on the input period and interval */
export function pickTableByPeriod(args: {
  now: Date;
  period: DateRange;
  interval?: ParsedInterval;
  /**
   * If true, it will pick the most precise table that can be resolved.
   * E.g. if the period is 1 day, by default it will pick the daily table.
   * If preciseAfter is set to 'hourly', it will pick the hourly table instead.
   */
  precision?: 'hourly' | 'minutely' | 'daily';
  logger?: Logger;
}): Table {
  // The oldest data point we can fetch from the database, per table.
  // ! We subtract 2 minutes as we round the date to the nearest minute on UI
  //   and there's also a chance that request will be made at 59th second of the minute
  //   and by the time it this function is called the minute will change.
  //   That's why we use 2 minutes as a buffer.
  const tableOldestDateTimePoint = {
    daily: subMinutes(startOfDay(subHours(args.now, tableTTLInHours.daily)), 2),
    hourly: subMinutes(startOfHour(subHours(args.now, tableTTLInHours.hourly)), 2),
    minutely: subMinutes(startOfMinute(subHours(args.now, tableTTLInHours.minutely)), 2),
  };

  const startTime = args.period.from.getTime();
  const endTime = args.period.to.getTime();

  if (
    startTime <= tableOldestDateTimePoint.daily.getTime() ||
    endTime <= tableOldestDateTimePoint.daily.getTime()
  ) {
    args.logger?.error(
      `Requested date range ${formatDate(args.period.from)} - ${formatDate(args.period.to)} is too old.`,
    );
    throw new Error(`The requested date range is too old for the selected query type.`);
  }

  const interval = args.interval;
  let possibleTables: Table[] = ['minutely', 'hourly', 'daily'];

  if (interval?.unit === 'm') {
    possibleTables = ['minutely'];
  } else if (interval?.unit === 'h') {
    possibleTables = ['hourly', 'minutely'];
  } else if (interval?.unit === 'd') {
    possibleTables = ['daily', 'hourly', 'minutely'];
  }

  const precision = args.precision;

  if (precision) {
    possibleTables = possibleTables.filter(table => table === precision);
  }

  const resolvableTables = possibleTables
    .filter(table => {
      return (
        startTime >= tableOldestDateTimePoint[table].getTime() &&
        endTime >= tableOldestDateTimePoint[table].getTime()
      );
    })
    .sort(
      // Sort by performance score, descending
      (a, b) => tablePerformanceScore[b] - tablePerformanceScore[a],
    );

  if (resolvableTables.length === 0) {
    args.logger?.error(
      `Requested date range ${formatDate(args.period.from)} - ${formatDate(args.period.to)}${interval ? ` with interval ${interval.value}${interval.unit}` : ''} cannot be resolved.`,
    );

    throw new Error(
      `The requested date range${interval ? 'and interval' : ''} cannot be resolved.`,
    );
  }

  return resolvableTables[0];
}
