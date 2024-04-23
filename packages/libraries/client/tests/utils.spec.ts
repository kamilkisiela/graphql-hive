import { cacheDocumentKey } from '../src/internal/utils';

test('produce identical hash for the same document and the same keys but different values in variables', async () => {
  const left = await cacheDocumentKey('doc', { a: true });
  const right = await cacheDocumentKey('doc', { a: false });
  expect(left).toEqual(right);
});

test('produce identical hash for the same document but with an empty array', async () => {
  const left = await cacheDocumentKey('doc', { a: [] });
  const right = await cacheDocumentKey('doc', { a: [] });
  expect(left).toEqual(right);
});

test('produce identical hash for the same document but with and without an empty array', async () => {
  const left = await cacheDocumentKey('doc', { a: [] });
  const right = await cacheDocumentKey('doc', { a: null });
  expect(left).toEqual(right);
});

test('produce identical hash for the same document but with an array of primitive values', async () => {
  const left = await cacheDocumentKey('doc', { a: [1, 2, 3] });
  const right = await cacheDocumentKey('doc', { a: [4, 5, 6] });
  expect(left).toEqual(right);
});

test('produce different hash for the same document but with different keys in variables', async () => {
  const left = await cacheDocumentKey('doc', { a: true });
  const right = await cacheDocumentKey('doc', { b: true });
  expect(left).not.toEqual(right);
});

test('produce different hash for the same document but with and without variables', async () => {
  const left = await cacheDocumentKey('doc', { a: true });
  const right = await cacheDocumentKey('doc', null);
  expect(left).not.toEqual(right);
});

test('produce different hash for the same document but with and without variables (empty object)', async () => {
  const left = await cacheDocumentKey('doc', { a: true });
  const right = await cacheDocumentKey('doc', {});
  expect(left).not.toEqual(right);
});
