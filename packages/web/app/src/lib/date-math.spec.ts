import { parse } from './date-math';

describe('parse', () => {
  const now = new Date('1996-06-25');
  it('should parse date', () => {
    expect(parse('now-10m', now)?.toISOString()).toEqual(`1996-06-24T23:50:00.000Z`);
  });
  it('can parse now', () => {
    expect(parse('now', now)?.toISOString()).toEqual(`1996-06-25T00:00:00.000Z`);
  });
  it('should not parse invalid parse date', () => {
    expect(parse('10m', now)?.toISOString()).toBeUndefined();
  });
  it('should return undefined for invalid date', () => {
    expect(parse('invalid', now)?.toISOString()).toBeUndefined();
  });
});
