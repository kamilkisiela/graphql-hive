import { pick } from './object';

describe('object', () => {
  describe('#pick', () => {
    it('returns a new object with only picked keys', () => {
      const input = { a: 1, b: 2, c: '1234' };
      const result = pick(input, ['a', 'c']);
      expect(result).toEqual({ a: 1, c: '1234' });
      expect(result).not.toBe(input);
    });

    it('returns an empty object if no key is present on input', () => {
      const input = { a: 1, b: 2, c: '1234' };
      expect(pick(input, ['d'])).toEqual({});
    });

    it('returns an empty object if no key is passed', () => {
      const input = { a: 1, b: 2, c: '1234' };
      expect(pick(input, [])).toEqual({});
    });

    it('returns an object with only presented keys', () => {
      const input = { a: 1, b: 2, c: '1234' };
      expect(pick(input, ['a', 'd'])).toEqual({ a: 1 });
    });
  });
});
