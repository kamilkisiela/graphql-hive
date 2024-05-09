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

const intervalUnitToTable = {
  m: 'minutely',
  h: 'hourly',
  d: 'daily',
} as const;

const tableAlternatives: Record<Table, Table[]> = {
  minutely: ['minutely'],
  hourly: ['hourly', 'minutely'],
  daily: ['daily', 'hourly', 'minutely'],
};

const tableFromDateCheck = {
  minutely: (date: Date) => date.getTime() === startOfMinute(date).getTime(),
  hourly: (date: Date) => date.getTime() === startOfHour(date).getTime(),
  daily: (date: Date) => date.getTime() === startOfDay(date).getTime(),
};

const precisionScore = {
  minutely: 3,
  hourly: 2,
  daily: 1,
};

/** pick the correct materialized view table for request data based on the input period */
export function pickTableByPeriod(args: {
  now: Date;
  period: DateRange;
  intervalUnit?: 'h' | 'd' | 'm';
  logger?: Logger;
}): Table {
  args.logger?.debug(
    'Picking table by period (from: %s, to: %s, intervalUnit: %s',
    args.period.from.toISOString(),
    args.period.to.toISOString(),
    args.intervalUnit ?? 'none',
  );
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
  const intervalUnit = args.intervalUnit ? intervalUnitToTable[args.intervalUnit] : undefined;

  let potentialTables: Array<'hourly' | 'daily' | 'minutely'> = ['daily', 'hourly', 'minutely'];

  // filter out tables can't be used due to TTL
  potentialTables = potentialTables.filter(
    table => args.period.from.getTime() >= tableOldestDateTimePoint[table].getTime(),
  );
  args.logger?.debug('Potential tables after TTL filter: %s', potentialTables.join(','));

  if (potentialTables.length === 0) {
    throw new Error(`The requested date range is too old for the selected query type.`);
  }

  if (intervalUnit) {
    // filter out tables that don't support the requested interval
    potentialTables = potentialTables.filter(table =>
      tableAlternatives[intervalUnit].includes(table),
    );
    args.logger?.debug(
      'Potential tables after interval unit filter: %s',
      potentialTables.join(','),
    );

    if (potentialTables.length === 0) {
      throw new Error(`Requested interval unit is not supported by any possible table.`);
    }

    // filter out tables that don't support the requested period
    // e.g. if the from date is 2021-01-01 12:00:00 and the interval is 'daily', we can't resolve it
    // as the daily table will have data for 2021-01-01 00:00:00
    potentialTables = potentialTables.filter(table => tableFromDateCheck[table](args.period.from));

    args.logger?.debug('Potential tables after start date filter: %s', potentialTables.join(','));
  }

  if (potentialTables.length === 0) {
    throw new Error(`Requested start date is not supported by any possible table.`);
  }

  // pick the table with the highest precision score
  // e.g. if the period is 3 hours and we can use hourly and minutely tables, we should pick the minutely table
  const table = potentialTables.sort((a, b) => precisionScore[b] - precisionScore[a])[0];

  args.logger?.debug('Selected table: %s', table);

  return table;
}
