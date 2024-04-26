import { parse } from '../date-math';
import { resolveRangeAndResolution } from './use-date-range-controller';

describe('useDateRangeController', () => {
  const testCases = [
    {
      now: '1992-10-21T10:10:00.000Z',
      from: 'now-1d',
      to: 'now',
      expected: {
        from: '1992-10-20T10:00:00.000Z',
        to: '1992-10-21T10:59:59.999Z', // endOfHour as it cannot use minutely aggregation
      },
    },
    {
      now: '1992-10-21T10:10:12.000Z',
      from: 'now-3h',
      to: 'now',
      expected: {
        from: '1992-10-21T07:10:00.000Z',
        to: '1992-10-21T10:10:59.999Z', // endOfMinute as it can use minutely aggregation
      },
    },
    {
      now: '1992-10-21T10:10:00.000Z',
      from: 'now-2d',
      to: 'now',
      expected: {
        from: '1992-10-19T10:00:00.000Z',
        to: '1992-10-21T10:59:59.999Z', // endOfHour as it cannot use minutely aggregation
      },
    },
    {
      now: '1992-10-21T10:10:00.000Z',
      from: 'now-7d',
      to: 'now',
      expected: {
        from: '1992-10-14T10:00:00.000Z',
        to: '1992-10-21T10:59:59.999Z', // endOfHour as it cannot use minutely aggregation
      },
    },
    {
      now: '1992-10-21T10:10:00.000Z',
      from: 'now-48d',
      to: 'now',
      expected: {
        from: '1992-09-03T00:00:00.000Z',
        to: '1992-10-21T23:59:59.999Z', // endOfDay as it cannot use minutely aggregation
      },
    },
    {
      now: '1992-10-21T10:10:00.000Z',
      from: 'now-48d', // 1992-09-03
      to: 'now-7d', // 1992-10-14
      expected: {
        from: '1992-09-03T00:00:00.000Z',
        to: '1992-10-14T23:59:59.999Z', // endOfDay as it cannot use minutely aggregation
      },
    },
  ];

  for (const testCase of testCases) {
    test(`${testCase.now} -> ${testCase.from} to ${testCase.to}`, () => {
      const now = new Date(testCase.now);
      const result = resolveRangeAndResolution(
        {
          from: parse(testCase.from, now)!,
          to: parse(testCase.to, now)!,
        },
        now,
      );
      expect(result).toEqual(
        expect.objectContaining({
          range: {
            from: new Date(testCase.expected.from),
            to: new Date(testCase.expected.to),
          },
        }),
      );
    });
  }
});
