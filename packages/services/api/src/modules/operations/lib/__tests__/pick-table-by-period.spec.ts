import { subDays } from '@/lib/date-time';
import { pickTableByPeriod } from '../pick-table-by-provider';

describe('pickTableByPeriod', () => {
  test('3 day period -> hourly', () => {
    const now = new Date();
    const table = pickTableByPeriod({
      now,
      period: {
        from: subDays(now, 3),
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
        from: subDays(now, 7),
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
        from: subDays(now, 14),
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
        from: subDays(now, 28),
        to: now,
      },
    });
    expect(table).toBe('hourly');
  });
  test('31 day period -> daily', () => {
    const now = new Date();
    const table = pickTableByPeriod({
      now,
      period: {
        from: subDays(now, 31),
        to: now,
      },
    });
    expect(table).toBe('daily');
  });
});
