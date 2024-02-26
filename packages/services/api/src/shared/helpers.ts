import { createHash } from 'crypto';
import type { InjectionToken } from 'graphql-modules';
import ms from 'ms';
import type {
  DateRangeInput,
  OrganizationSelector,
  ProjectSelector,
  TargetSelector,
} from '../__generated__/types';
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

export function filterSelector(
  kind: 'organization',
  selector: OrganizationSelector,
): OrganizationSelector;
export function filterSelector(kind: 'project', selector: ProjectSelector): ProjectSelector;
export function filterSelector(kind: 'target', selector: TargetSelector): TargetSelector;
export function filterSelector(kind: 'organization' | 'project' | 'target', selector: any): any {
  switch (kind) {
    case 'organization':
      return {
        organization: selector.organization,
      };
    case 'project':
      return {
        organization: selector.organization,
        project: selector.project,
      };
    case 'target':
      return {
        organization: selector.organization,
        project: selector.project,
        target: selector.target,
      };
  }
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
    return value;
  }

  if (typeof value === 'string') {
    if (validateDateTime(value)) {
      return new Date(value);
    }
    throw new TypeError(`DateTime cannot represent an invalid date-time-string ${value}.`);
  }

  if (typeof value === 'number') {
    try {
      return new Date(value);
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
  const to = new Date();
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

/**
 * Batch processing of items based on a built key
 */
export function batchBy<TItem, TResult>(
  /** Function to determine the batch group. */
  buildBatchKey: (arg: TItem) => string,
  /** Loader for each batch group. */
  loader: (args: TItem[]) => Promise<Promise<TResult>[]>,
) {
  let batchGroups = new Map<
    string,
    {
      args: TItem[];
      callbacks: Array<{ resolve: (result: TResult) => void; reject: (error: Error) => void }>;
    }
  >();
  let didSchedule = false;

  return (arg: TItem): Promise<TResult> => {
    const key = buildBatchKey(arg);
    let currentBatch = batchGroups.get(key);
    if (!currentBatch) {
      currentBatch = {
        args: [],
        callbacks: [],
      };
      batchGroups.set(key, currentBatch);
    }

    if (!didSchedule) {
      didSchedule = true;
      process.nextTick(() => {
        for (const currentBatch of batchGroups.values()) {
          const tickArgs = [...currentBatch.args];
          const tickCallbacks = [...currentBatch.callbacks];

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
        // reset the batch
        batchGroups = new Map();
        didSchedule = false;
      });
    }
    currentBatch.args.push(arg);
    const { callbacks } = currentBatch;
    return new Promise((resolve, reject) => {
      callbacks.push({ resolve, reject });
    });
  };
}
