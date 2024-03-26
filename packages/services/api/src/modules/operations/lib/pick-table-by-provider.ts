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

const msMinute = 60 * 1_000;
const msHour = msMinute * 60;
const msDay = msHour * 24;

// How long rows are kept in the database, per table.
const tableTTLInHours = {
  daily: 365 * 24,
  hourly: 30 * 24,
  minutely: 24,
};

const thresholdDataPointPerDay = 28;
const thresholdDataPointPerHour = 24;

function formatDate(date: Date): string {
  return format(addMinutes(date, date.getTimezoneOffset()), 'yyyy-MM-dd HH:mm:ss');
}

/** pick the correct materialized view table for request data based on the input period */
export function pickTableByPeriod(args: {
  now: Date;
  period: DateRange;
  logger?: Logger;
}): 'hourly' | 'daily' | 'minutely' {
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

  if (
    args.period.to.getTime() <= tableOldestDateTimePoint.daily.getTime() ||
    args.period.from.getTime() <= tableOldestDateTimePoint.daily.getTime()
  ) {
    args.logger?.error(
      `Requested date range ${formatDate(args.period.from)} - ${formatDate(args.period.to)} is too old.`,
    );
    throw new Error(`The requested date range is too old for the selected query type.`);
  }

  const daysDifference = Math.floor(
    (args.period.to.getTime() - args.period.from.getTime()) / msDay,
  );

  if (
    daysDifference >= thresholdDataPointPerDay ||
    args.period.to.getTime() <= tableOldestDateTimePoint.hourly.getTime() ||
    args.period.from.getTime() <= tableOldestDateTimePoint.hourly.getTime()
  ) {
    return 'daily';
  }

  const hoursDifference = (args.period.to.getTime() - args.period.from.getTime()) / msHour;
  if (
    hoursDifference >= thresholdDataPointPerHour ||
    args.period.to.getTime() <= tableOldestDateTimePoint.minutely.getTime() ||
    args.period.from.getTime() <= tableOldestDateTimePoint.minutely.getTime()
  ) {
    return 'hourly';
  }

  return 'minutely';
}
