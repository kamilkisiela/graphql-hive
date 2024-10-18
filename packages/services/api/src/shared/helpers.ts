import { createHash } from 'node:crypto';
import type { InjectionToken } from 'graphql-modules';
import ms from 'ms';
import { UTCDate } from '@date-fns/utc';
import type { DateRangeInput } from '../__generated__/types.next';
import { DateRange } from './entities';

export {
  msToNs,
  nsToMs,
  atomicPromise as atomic,
  sharePromise as share,
  cacheResult as cache,
} from '@theguild/buddy';

export type NullableAndPartial<T> = {
  [P in keyof T]?: T[P] | undefined | null;
};
export type NullableDictionary<T> = { [P in keyof T]: T[P] | null };

export type Listify<T, K extends keyof T> = Omit<T, K> & {
  [key in K]: T[K] | readonly T[K][];
};

export type MapToArray<T, K extends keyof T> = Omit<T, K> & {
  [key in K]: readonly T[K][];
};

export function uuid(len = 13) {
  return Math.random().toString(16).substr(2, len);
}

export function stringifySelector<
  T extends {
    [key: string]: any;
  },
>(obj: T): string {
  return JSON.stringify(
    Object.keys(obj)
      .sort()
      .map(key => [key, obj[key]]),
  );
}

function validateDateTime(dateTimeString?: string) {
  dateTimeString =
    dateTimeString === null || dateTimeString === void 0 ? void 0 : dateTimeString.toUpperCase();

  if (!dateTimeString) {
    return false;
  }

  const RFC_3339_REGEX =
    /^(\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60))(\.\d{1,})?(([Z])|([+|-]([01][0-9]|2[0-3]):[0-5][0-9]))$/;
  // Validate the structure of the date-string
  if (!RFC_3339_REGEX.test(dateTimeString)) {
    return false;
  }
  // Check if it is a correct date using the javascript Date parse() method.
  const time = Date.parse(dateTimeString);
  if (time !== time) {
    return false;
  }
  // Split the date-time-string up into the string-date and time-string part.
  // and check whether these parts are RFC 3339 compliant.
  const index = dateTimeString.indexOf('T');
  const dateString = dateTimeString.substr(0, index);
  const timeString = dateTimeString.substr(index + 1);
  return validateDate(dateString) && validateTime(timeString);
}

function validateTime(time?: string) {
  time = time === null || time === void 0 ? void 0 : time.toUpperCase();

  if (!time) {
    return false;
  }

  const TIME_REGEX =
    /^([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.\d{1,})?(([Z])|([+|-]([01][0-9]|2[0-3]):[0-5][0-9]))$/;
  return TIME_REGEX.test(time);
}

function validateDate(datestring: string) {
  const RFC_3339_REGEX = /^(\d{4}-(0[1-9]|1[012])-(0[1-9]|[12][0-9]|3[01]))$/;
  if (!RFC_3339_REGEX.test(datestring)) {
    return false;
  }
  // Verify the correct number of days for
  // the month contained in the date-string.
  const year = Number(datestring.substr(0, 4));
  const month = Number(datestring.substr(5, 2));
  const day = Number(datestring.substr(8, 2));
  switch (month) {
    case 2: // February
      if (leapYear(year) && day > 29) {
        return false;
      }
      if (!leapYear(year) && day > 28) {
        return false;
      }
      return true;
    case 4: // April
    case 6: // June
    case 9: // September
    case 11: // November
      if (day > 30) {
        return false;
      }
      break;
  }
  return true;
}

function leapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function parseDateTime(value: number | string | Date): Date {
  if (value instanceof Date) {
    return new UTCDate(value);
  }

  if (typeof value === 'string') {
    if (validateDateTime(value)) {
      return new UTCDate(value);
    }
    throw new TypeError(`DateTime cannot represent an invalid date-time-string ${value}.`);
  }

  if (typeof value === 'number') {
    try {
      return new UTCDate(value);
    } catch (e) {
      throw new TypeError('DateTime cannot represent an invalid Unix timestamp ' + value);
    }
  }

  throw new TypeError(
    'DateTime cannot be serialized from a non string, ' +
      'non numeric or non Date type ' +
      JSON.stringify(value),
  );
}

export function parseDateRangeInput(period: DateRangeInput): DateRange {
  return {
    from: parseDateTime(period.from),
    to: parseDateTime(period.to),
  };
}

export function createPeriod(period: string): DateRange {
  const to = new UTCDate();
  const from = to.getTime() - ms(period);

  return {
    from: parseDateTime(from),
    to,
  };
}

export type TypeOfToken<T> = T extends InjectionToken<infer R> ? R : unknown;

export type Optional<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>> & Partial<Pick<T, K>>;

export function hash(key: string): string {
  return createHash('md5').update(key).digest('hex');
}

/**
 * A function that accepts two arrays and returns a difference
 */
export function diffArrays<T>(left: readonly T[], right: readonly T[]): readonly T[] {
  return left.filter(val => !right.includes(val)).concat(right.filter(val => !left.includes(val)));
}

export function pushIfMissing<T>(list: T[], item: T): void {
  if (!list.includes(item)) {
    list.push(item);
  }
}

export type PromiseOrValue<T> = Promise<T> | T;

type BatchGroup<TItem, TResult> = {
  args: TItem[];
  callbacks: Array<{ resolve: (result: TResult) => void; reject: (error: Error) => void }>;
};

/**
 * Batch processing of items based on a built key
 */
export function batchBy<TItem, TResult>(
  /** Function to determine the batch group. */
  buildBatchKey: (arg: TItem) => string,
  /** Loader for each batch group. */
  loader: (args: TItem[]) => Promise<Promise<TResult>[]>,
  /** Maximum amount of items per batch, if it is exceeded a new batch for a given batchKey is created. */
  maxBatchSize = Infinity,
) {
  let batchGroups = new Map<string, BatchGroup<TItem, TResult>>();
  let didSchedule = false;

  function startLoadingBatch(currentBatch: BatchGroup<TItem, TResult>): void {
    const tickArgs = [...currentBatch.args];
    const tickCallbacks = [...currentBatch.callbacks];

    if (tickArgs.length !== tickCallbacks.length) {
      for (const cb of tickCallbacks) {
        cb.reject(new Error('Batch args and callbacks should have the same length.'));
      }
      throw new Error('Batch args and callbacks should have the same length.');
    }

    loader(tickArgs).then(
      promises => {
        for (let i = 0; i < tickCallbacks.length; i++) {
          promises[i].then(
            result => {
              tickCallbacks[i].resolve(result);
            },
            error => {
              tickCallbacks[i].reject(error);
            },
          );
        }
      },
      error => {
        for (let i = 0; i < tickCallbacks.length; i++) {
          tickCallbacks[i].reject(error);
        }
      },
    );
  }

  function getBatchGroup(batchKey: string) {
    // get the batch collection for the batch key
    let currentBatch = batchGroups.get(batchKey);
    // if it does not exist or the batch is full, create a new batch
    if (currentBatch === undefined) {
      currentBatch = {
        args: [],
        callbacks: [],
      };
      batchGroups.set(batchKey, currentBatch);
    }

    return currentBatch;
  }

  function scheduleExecutionOnNextTick() {
    if (didSchedule) {
      return;
    }
    didSchedule = true;
    process.nextTick(() => {
      for (const currentBatch of batchGroups.values()) {
        startLoadingBatch(currentBatch);
      }
      // reset the batch
      batchGroups = new Map();
      didSchedule = false;
    });
  }

  return (arg: TItem): Promise<TResult> => {
    const batchKey = buildBatchKey(arg);
    const currentBatch = getBatchGroup(batchKey);
    scheduleExecutionOnNextTick();
    currentBatch.args.push(arg);
    const d = Promise.withResolvers<TResult>();
    currentBatch.callbacks.push({ resolve: d.resolve, reject: d.reject });

    // if the current batch is full, we already start loading it.
    if (currentBatch.callbacks.length >= maxBatchSize) {
      batchGroups.delete(batchKey);
      startLoadingBatch(currentBatch);
    }

    return d.promise;
  };
}

export function assertOk<TOk extends { ok: true }, TNot extends { ok: false; message: string }>(
  result: TOk | TNot,
  message: string,
): asserts result is TOk {
  if (!result.ok) {
    throw new Error(`${message}: ${result.message}`);
  }
}
