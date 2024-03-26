import { subDays } from 'date-fns';
import { pickTableByPeriod } from '../pick-table-by-provider';

describe('pickTableByPeriod', () => {
  test('3 day period -> hourly', () => {
    const now = new Date();
    const table = pickTableByPeriod({
      now,
      period: {
        from: subDays(new Date(), 3),
        to: now,
      },
    });
    expect(table).toBe('hourly');
  });
  test('7 day period -> hourly', () => {
    const now = new Date();
    const table = pickTableByPeriod({
      now,
      period: {
        from: subDays(new Date(), 7),
        to: now,
      },
    });
    expect(table).toBe('hourly');
  });
  test('14 day period -> hourly', () => {
    const now = new Date();
    const table = pickTableByPeriod({
      now,
      period: {
        from: subDays(new Date(), 14),
        to: now,
      },
    });
    expect(table).toBe('hourly');
  });
  test('28 day period -> hourly', () => {
    const now = new Date();
    const table = pickTableByPeriod({
      now,
      period: {
        from: subDays(new Date(), 28),
        to: now,
      },
    });
    expect(table).toBe('daily');
  });
});
