import { subDays, subHours, subMonths } from 'date-fns';
import { parseInterval } from '../interval';
import { pickTableByPeriod } from '../pick-table-by-provider';

describe('pickTableByPeriod', () => {
  describe('no interval', () => {
    const now = new Date();
    const tests: Array<
      {
        from: Date;
        to: Date;
        label: string;
      } & (
        | {
            expected: 'daily' | 'hourly' | 'minutely';
          }
        | {
            expected: 'error';
          }
      )
    > = [
      {
        from: subDays(now, 1),
        to: now,
        expected: 'daily',
        label: '1 day period = daily',
      },
      {
        from: subDays(now, 3),
        to: now,
        expected: 'daily',
        label: '3 day period = daily',
      },
      {
        from: subDays(now, 7),
        to: now,
        expected: 'daily',
        label: '7 day period = daily',
      },
      {
        from: subDays(now, 14),
        to: now,
        expected: 'daily',
        label: '14 day period = daily',
      },
      {
        from: subDays(now, 31),
        to: now,
        expected: 'daily',
        label: '31 day period = daily',
      },
      {
        from: subMonths(now, 13),
        to: now,
        expected: 'error',
        label: '13 months period = throw',
      },
    ];

    for (const { from, to, expected, label } of tests) {
      test(label, () => {
        if (expected === 'error') {
          expect(() => pickTableByPeriod({ now, period: { from, to } })).toThrowError();
        } else {
          const result = pickTableByPeriod({ now, period: { from, to } });
          expect(result).toBe(expected);
        }
      });
    }
  });

  describe('no interval + precision', () => {
    const now = new Date();
    const tests: Array<
      {
        from: Date;
        to: Date;
        label: string;
        precision: 'daily' | 'hourly' | 'minutely';
      } & (
        | {
            expected: 'daily' | 'hourly' | 'minutely';
          }
        | {
            expected: 'error';
          }
      )
    > = [
      {
        from: subHours(now, 1),
        to: now,
        expected: 'minutely',
        precision: 'minutely',
        label: 'now-1h ~ m = minutely',
      },
      {
        from: subHours(now, 1),
        to: now,
        expected: 'minutely',
        precision: 'minutely',
        label: 'now-1h ~ m = minutely',
      },
      {
        from: subHours(now, 24),
        to: now,
        expected: 'minutely',
        precision: 'minutely',
        label: 'now-24h ~ m = minutely',
      },
      {
        from: subHours(now, 26),
        to: now,
        expected: 'error',
        precision: 'minutely',
        label: 'now-26h ~ m = error',
      },
      {
        from: subDays(now, 1),
        to: now,
        expected: 'minutely',
        precision: 'minutely',
        label: 'now-1d ~ m = minutely',
      },
      {
        from: subDays(now, 1),
        to: now,
        expected: 'hourly',
        precision: 'hourly',
        label: 'now-1d ~ h = hourly',
      },
      {
        from: subDays(now, 3),
        to: now,
        expected: 'hourly',
        precision: 'hourly',
        label: 'now-3d ~ h = hourly',
      },
      {
        from: subDays(now, 7),
        to: now,
        expected: 'hourly',
        precision: 'hourly',
        label: 'now-7d ~ h = hourly',
      },
      {
        from: subDays(now, 14),
        to: now,
        expected: 'hourly',
        precision: 'hourly',
        label: 'now-14d ~ h = hourly',
      },
      {
        from: subDays(now, 31),
        to: now,
        expected: 'error',
        precision: 'hourly',
        label: 'now-31d ~ h = error',
      },
      {
        from: subMonths(now, 13),
        to: now,
        expected: 'error',
        precision: 'hourly',
        label: 'now-13M ~ h = throw',
      },
    ];

    for (const { from, to, expected, label, precision } of tests) {
      test(label, () => {
        if (expected === 'error') {
          expect(() => pickTableByPeriod({ now, period: { from, to }, precision })).toThrowError();
        } else {
          const result = pickTableByPeriod({ now, period: { from, to }, precision });
          expect(result).toBe(expected);
        }
      });
    }
  });

  describe('with interval', () => {
    const now = new Date();
    const tests: Array<
      {
        from: Date;
        to: Date;
        label: string;
        interval: `${number}${'m' | 'h' | 'd'}`;
      } & (
        | {
            expected: 'daily' | 'hourly' | 'minutely';
          }
        | {
            expected: 'error';
          }
      )
    > = [
      {
        from: subDays(now, 1),
        to: now,
        interval: '1d',
        expected: 'daily',
        label: 'now-1d/1d = daily',
      },
      {
        from: subDays(now, 1),
        to: now,
        interval: '1m',
        expected: 'minutely',
        label: 'now-1d/1m = minutely',
      },
      {
        from: subDays(now, 1),
        to: now,
        interval: '1h',
        expected: 'hourly',
        label: 'now-1d/1h = hourly',
      },
      {
        from: subDays(now, 2),
        to: now,
        interval: '2d',
        expected: 'daily',
        label: 'now-2d/1d = daily',
      },
      {
        from: subDays(now, 2),
        to: now,
        interval: '24h',
        expected: 'daily',
        label: 'now-2d/24h = daily',
      },
      {
        from: subDays(now, 2),
        to: now,
        interval: '48h',
        expected: 'daily',
        label: 'now-2d/48h = daily',
      },
      {
        from: subDays(now, 2),
        to: now,
        interval: '47h',
        expected: 'hourly',
        label: 'now-2d/47h = hourly',
      },
      {
        from: subDays(now, 2),
        to: now,
        interval: '1m',
        expected: 'error',
        label: 'now-2d/1m = error',
      },
      {
        from: subDays(now, 3),
        to: now,
        interval: '1d',
        expected: 'daily',
        label: 'now-3d/1d = daily',
      },
      {
        from: subDays(now, 3),
        to: now,
        interval: '1m',
        expected: 'error',
        label: 'now-3d/1m = error',
      },
      {
        from: subDays(now, 3),
        to: now,
        interval: '1h',
        expected: 'hourly',
        label: 'now-3d/1h = hourly',
      },
      {
        from: subDays(now, 7),
        to: now,
        interval: '1d',
        expected: 'daily',
        label: 'now-7d/1d = daily',
      },
      {
        from: subDays(now, 7),
        to: now,
        interval: '1h',
        expected: 'hourly',
        label: 'now-7d/1d = hourly',
      },
      {
        from: subDays(now, 7),
        to: now,
        interval: '24h',
        expected: 'daily',
        label: 'now-7d/24h = daily',
      },
      {
        from: subDays(now, 7),
        to: now,
        interval: '48h',
        expected: 'daily',
        label: 'now-7d/48h = daily',
      },
      {
        from: subDays(now, 7),
        to: now,
        interval: '168h',
        expected: 'daily',
        label: 'now-7d/168h = daily',
      },
      {
        from: subDays(now, 14),
        to: now,
        interval: '1d',
        expected: 'daily',
        label: 'now-14d/1d = daily',
      },
      {
        from: subDays(now, 14),
        to: now,
        interval: '1h',
        expected: 'hourly',
        label: 'now-14d/1h = hourly',
      },
      {
        from: subDays(now, 31),
        to: now,
        interval: '1d',
        expected: 'daily',
        label: 'now-31d/1d = daily',
      },
      {
        from: subDays(now, 31),
        to: now,
        interval: '1h',
        expected: 'error',
        label: 'now-31d/1h = error',
      },
      {
        from: subDays(now, 180),
        to: now,
        interval: '32d',
        expected: 'daily',
        label: 'now-180d/32d = daily',
      },
      {
        from: subDays(now, 60),
        to: subDays(now, 30),
        interval: '1d',
        expected: 'daily',
        label: '60d-30d/1d = daily',
      },
      {
        from: subDays(now, 60),
        to: subDays(now, 30),
        interval: '1h',
        expected: 'error',
        label: '60d-30d/1h = error',
      },
      {
        from: subDays(now, 32),
        to: subDays(now, 30),
        interval: '1h',
        expected: 'error',
        label: '32d-30d/1h = error',
      },
      {
        from: subDays(now, 5),
        to: subDays(now, 3),
        interval: '1h',
        expected: 'hourly',
        label: '5d-3d/1h = hourly',
      },
      {
        from: subDays(now, 30),
        to: subDays(now, 28),
        interval: '1h',
        expected: 'hourly',
        label: '30d-28d/1h = hourly',
      },
      {
        from: subDays(now, 31),
        to: subDays(now, 28),
        interval: '1h',
        expected: 'error',
        label: '31d-28d/1h = error',
      },
    ];

    for (const { from, to, expected, interval, label } of tests) {
      test(label, () => {
        if (expected === 'error') {
          expect(() =>
            pickTableByPeriod({ now, period: { from, to }, interval: parseInterval(interval) }),
          ).toThrowError();
        } else {
          const result = pickTableByPeriod({
            now,
            period: { from, to },
            interval: parseInterval(interval),
          });
          expect(result).toBe(expected);
        }
      });
    }
  });

  describe('interval + precision', () => {
    const now = new Date();
    const tests: Array<
      {
        from: Date;
        to: Date;
        label: string;
        precision: 'daily' | 'hourly' | 'minutely';
        interval: `${number}${'m' | 'h' | 'd'}`;
      } & (
        | {
            expected: 'daily' | 'hourly' | 'minutely';
          }
        | {
            expected: 'error';
          }
      )
    > = [
      {
        from: subDays(now, 1),
        to: now,
        interval: '1d',
        precision: 'hourly',
        expected: 'hourly',
        label: 'now-1d/1d ~ h = hourly',
      },
      {
        from: subDays(now, 1),
        to: now,
        interval: '1m',
        precision: 'minutely',
        expected: 'minutely',
        label: 'now-1d/1m ~ m = minutely',
      },
      {
        from: subDays(now, 1),
        to: now,
        interval: '1h',
        precision: 'minutely',
        expected: 'minutely',
        label: 'now-1d/1h ~ m = minutely',
      },
      {
        from: subDays(now, 2),
        to: now,
        interval: '2d',
        precision: 'hourly',
        expected: 'hourly',
        label: 'now-2d/1d ~ h = hourly',
      },
      {
        from: subDays(now, 2),
        to: now,
        interval: '24h',
        precision: 'hourly',
        expected: 'hourly',
        label: 'now-2d/24h ~ h = hourly',
      },
      {
        from: subDays(now, 2),
        to: now,
        interval: '48h',
        precision: 'hourly',
        expected: 'hourly',
        label: 'now-2d/48h ~ h = hourly',
      },
      {
        from: subDays(now, 2),
        to: now,
        interval: '47h',
        precision: 'hourly',
        expected: 'hourly',
        label: 'now-2d/47h ~ h = hourly',
      },
      {
        from: subDays(now, 2),
        to: now,
        interval: '1m',
        precision: 'minutely',
        expected: 'error',
        label: 'now-2d/1m ~ m = error',
      },
      {
        from: subDays(now, 2),
        to: now,
        interval: '1h',
        precision: 'minutely',
        expected: 'error',
        label: 'now-2d/1h ~ m = error',
      },
      {
        from: subDays(now, 3),
        to: now,
        interval: '1d',
        precision: 'hourly',
        expected: 'hourly',
        label: 'now-3d/1d ~ h = hourly',
      },
      {
        from: subDays(now, 3),
        to: now,
        interval: '1m',
        precision: 'minutely',
        expected: 'error',
        label: 'now-3d/1m ~ m = error',
      },
      {
        from: subDays(now, 3),
        to: now,
        interval: '1h',
        precision: 'minutely',
        expected: 'error',
        label: 'now-3d/1h ~ m = error',
      },
      {
        from: subDays(now, 3),
        to: now,
        interval: '1h',
        precision: 'daily',
        expected: 'error',
        label: 'now-3d/1h ~ d = error',
      },
      {
        from: subDays(now, 3),
        to: now,
        interval: '1h',
        precision: 'hourly',
        expected: 'hourly',
        label: 'now-3d/1h ~ h = hourly',
      },
      {
        from: subDays(now, 7),
        to: now,
        interval: '1d',
        precision: 'hourly',
        expected: 'hourly',
        label: 'now-7d/1d ~ h = hourly',
      },
      {
        from: subDays(now, 7),
        to: now,
        interval: '1d',
        precision: 'daily',
        expected: 'daily',
        label: 'now-7d/1d ~ d = daily',
      },
      {
        from: subDays(now, 7),
        to: now,
        interval: '1h',
        expected: 'hourly',
        precision: 'hourly',
        label: 'now-7d/1d ~ h = hourly',
      },
      {
        from: subDays(now, 7),
        to: now,
        interval: '24h',
        precision: 'hourly',
        expected: 'hourly',
        label: 'now-7d/24h ~ h = hourly',
      },
      {
        from: subDays(now, 7),
        to: now,
        interval: '24h',
        precision: 'daily',
        expected: 'daily',
        label: 'now-7d/24h ~ d = daily',
      },
      {
        from: subDays(now, 7),
        to: now,
        interval: '48h',
        precision: 'daily',
        expected: 'daily',
        label: 'now-7d/48h ~ d = daily',
      },
      {
        from: subDays(now, 7),
        to: now,
        interval: '168h',
        precision: 'daily',
        expected: 'daily',
        label: 'now-7d/168h ~ d = daily',
      },
      {
        from: subDays(now, 14),
        to: now,
        interval: '1d',
        precision: 'daily',
        expected: 'daily',
        label: 'now-14d/1d ~ d = daily',
      },
      {
        from: subDays(now, 14),
        to: now,
        interval: '1h',
        precision: 'hourly',
        expected: 'hourly',
        label: 'now-14d/1h ~ h = hourly',
      },
      {
        from: subDays(now, 31),
        to: now,
        interval: '1d',
        precision: 'daily',
        expected: 'daily',
        label: 'now-31d/1d ~ d = daily',
      },
      {
        from: subDays(now, 31),
        to: now,
        interval: '1h',
        precision: 'daily',
        expected: 'error',
        label: 'now-31d/1h ~ d = error',
      },
      {
        from: subDays(now, 180),
        to: now,
        interval: '32d',
        precision: 'daily',
        expected: 'daily',
        label: 'now-180d/32d ~ d = daily',
      },
      {
        from: subDays(now, 60),
        to: subDays(now, 30),
        interval: '1d',
        precision: 'daily',
        expected: 'daily',
        label: '60d-30d/1d ~ d = daily',
      },
      {
        from: subDays(now, 60),
        to: subDays(now, 30),
        interval: '1h',
        precision: 'daily',
        expected: 'error',
        label: '60d-30d/1h ~ d = error',
      },
      {
        from: subDays(now, 32),
        to: subDays(now, 30),
        interval: '1h',
        precision: 'daily',
        expected: 'error',
        label: '32d-30d/1h ~ d = error',
      },
      {
        from: subDays(now, 32),
        to: subDays(now, 30),
        interval: '1h',
        precision: 'hourly',
        expected: 'error',
        label: '32d-30d/1h ~ h = error',
      },
      {
        from: subDays(now, 5),
        to: subDays(now, 3),
        interval: '1h',
        precision: 'hourly',
        expected: 'hourly',
        label: '5d-3d/1h ~ h = hourly',
      },
      {
        from: subDays(now, 5),
        to: subDays(now, 3),
        interval: '1h',
        precision: 'daily',
        expected: 'error',
        label: '5d-3d/1h ~ d = error',
      },
      {
        from: subDays(now, 30),
        to: subDays(now, 28),
        interval: '1h',
        precision: 'hourly',
        expected: 'hourly',
        label: '30d-28d/1h ~ h = hourly',
      },
      {
        from: subDays(now, 31),
        to: subDays(now, 28),
        interval: '1h',
        precision: 'daily',
        expected: 'error',
        label: '31d-28d/1h ~ d = error',
      },
    ];

    for (const { from, to, expected, interval, precision, label } of tests) {
      test(label, () => {
        if (expected === 'error') {
          expect(() =>
            pickTableByPeriod({
              now,
              period: { from, to },
              precision,
              interval: parseInterval(interval),
            }),
          ).toThrowError();
        } else {
          const result = pickTableByPeriod({
            now,
            period: { from, to },
            precision,
            interval: parseInterval(interval),
          });
          expect(result).toBe(expected);
        }
      });
    }
  });
});
