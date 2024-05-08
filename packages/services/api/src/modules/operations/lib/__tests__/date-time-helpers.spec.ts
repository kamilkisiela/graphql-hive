import { toEndOfInterval, toStartOfInterval } from '../date-time-helpers';

describe('toStartOfInterval', () => {
  test('1 DAY - rounds middle of the day to start of the day', () => {
    expect(toStartOfInterval(new Date('2021-03-23T11:00:00.000Z'), 1, 'd').toISOString()).toBe(
      '2021-03-23T00:00:00.000Z',
    );
  });

  test('2 DAY - rounds middle of the day to start of the every second day', () => {
    expect(toStartOfInterval(new Date('2021-03-23T11:00:00.000Z'), 2, 'd').toISOString()).toBe(
      '2021-03-22T00:00:00.000Z',
    );
    expect(toStartOfInterval(new Date('2021-01-01T11:00:00.000Z'), 2, 'd').toISOString()).toBe(
      '2021-01-01T00:00:00.000Z',
    );
  });

  test('1 HOUR - rounds middle of the hour to start of the hour', () => {
    expect(toStartOfInterval(new Date('2021-03-23T11:30:00.000Z'), 1, 'h').toISOString()).toBe(
      '2021-03-23T11:00:00.000Z',
    );
  });

  test('1 MINUTE - rounds middle of the minute to start of the minute', () => {
    expect(toStartOfInterval(new Date('2021-03-23T11:30:50.000Z'), 1, 'm').toISOString()).toBe(
      '2021-03-23T11:30:00.000Z',
    );
  });

  test('handles month bounds', () => {
    expect(toStartOfInterval(new Date('2021-02-01T11:00:00.000Z'), 2, 'd').toISOString()).toBe(
      '2021-01-31T00:00:00.000Z',
    );
  });

  test('handles day bounds', () => {
    expect(toStartOfInterval(new Date('2021-02-01T01:00:00.000Z'), 25, 'h').toISOString()).toBe(
      '2021-01-31T08:00:00.000Z',
    );
  });

  test('handles hour bounds', () => {
    expect(toStartOfInterval(new Date('2021-02-01T12:01:00.000Z'), 70, 'm').toISOString()).toBe(
      '2021-02-01T11:20:00.000Z',
    );
  });
});

describe('toEndOfInterval', () => {
  test('1 DAY - rounds middle of the day to end of the day', () => {
    expect(toEndOfInterval(new Date('2021-03-23T11:00:00.000Z'), 1, 'd').toISOString()).toBe(
      '2021-03-23T23:59:59.999Z',
    );
  });

  test('2 DAY - rounds middle of the day to start of the every second day', () => {
    expect(toEndOfInterval(new Date('2021-03-23T11:00:00.000Z'), 2, 'd').toISOString()).toBe(
      '2021-03-23T23:59:59.999Z',
    );
    expect(toEndOfInterval(new Date('2021-01-01T11:00:00.000Z'), 2, 'd').toISOString()).toBe(
      '2021-01-02T23:59:59.999Z',
    );
  });

  test('1 HOUR - rounds middle of the hour to the end of the hour', () => {
    expect(toEndOfInterval(new Date('2021-03-23T11:30:00.000Z'), 1, 'h').toISOString()).toBe(
      '2021-03-23T11:59:59.999Z',
    );
  });

  test('1 MINUTE - rounds middle of the minute to the end of the minute', () => {
    expect(toEndOfInterval(new Date('2021-03-23T11:30:50.000Z'), 1, 'm').toISOString()).toBe(
      '2021-03-23T11:30:59.999Z',
    );
  });

  test('handles month bounds', () => {
    expect(toEndOfInterval(new Date('2021-01-31T11:00:00.000Z'), 2, 'd').toISOString()).toBe(
      '2021-02-01T23:59:59.999Z',
    );
  });

  test('handles day bounds', () => {
    expect(toEndOfInterval(new Date('2021-02-02T23:59:00.000Z'), 25, 'h').toISOString()).toBe(
      '2021-02-03T10:59:59.999Z',
    );
  });

  test('handles hour bounds', () => {
    expect(toEndOfInterval(new Date('2021-02-01T12:38:00.000Z'), 70, 'm').toISOString()).toBe(
      '2021-02-01T13:39:59.999Z',
    );
  });
});
