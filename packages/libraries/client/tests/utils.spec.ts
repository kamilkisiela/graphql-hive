import { cacheDocumentKey } from '../src/internal/utils';

test('produce identical hash for the same document and the same keys but different values in variables', () => {
  const left = cacheDocumentKey('doc', { a: true });
  const right = cacheDocumentKey('doc', { a: false });
  expect(left).toEqual(right);
});

test('produce identical hash for the same document but with an empty array', () => {
  const left = cacheDocumentKey('doc', { a: [] });
  const right = cacheDocumentKey('doc', { a: [] });
  expect(left).toEqual(right);
});

test('produce identical hash for the same document but with and without an empty array', () => {
  const left = cacheDocumentKey('doc', { a: [] });
  const right = cacheDocumentKey('doc', { a: null });
  expect(left).toEqual(right);
});

test('produce identical hash for the same document but with an array of primitive values', () => {
  const left = cacheDocumentKey('doc', { a: [1, 2, 3] });
  const right = cacheDocumentKey('doc', { a: [4, 5, 6] });
  expect(left).toEqual(right);
});

test('produce different hash for the same document but with different keys in variables', () => {
  const left = cacheDocumentKey('doc', { a: true });
  const right = cacheDocumentKey('doc', { b: true });
  expect(left).not.toEqual(right);
});

test('produce different hash for the same document but with and without variables', () => {
  const left = cacheDocumentKey('doc', { a: true });
  const right = cacheDocumentKey('doc', null);
  expect(left).not.toEqual(right);
});

test('produce different hash for the same document but with and without variables (empty object)', () => {
  const left = cacheDocumentKey('doc', { a: true });
  const right = cacheDocumentKey('doc', {});
  expect(left).not.toEqual(right);
});
