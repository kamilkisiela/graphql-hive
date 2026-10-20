import { hashOperationIdentity } from '@graphql-hive/core';
import { getDocumentInsightsHash } from './insights-hash';

test('derives the hash from the normalized body and operation name', () => {
  expect(
    getDocumentInsightsHash({
      body: 'query GetUser($id: ID!) { user(id: $id) { id, name } }',
      operationName: 'GetUser',
      internalHash: 'stored',
    }),
  ).toBe(
    hashOperationIdentity({
      body: 'query GetUser($id:ID!){user(id:$id){id name}}',
      operationName: 'GetUser',
    }),
  );
});

test('uses the name from the document when none is stored', () => {
  expect(
    getDocumentInsightsHash({
      body: 'query GetUser { me { id } }',
      operationName: null,
      internalHash: 'stored',
    }),
  ).toBe(hashOperationIdentity({ body: 'query GetUser{me{id}}', operationName: 'GetUser' }));
});

test('falls back to the stored hash when the body does not parse', () => {
  expect(
    getDocumentInsightsHash({ body: 'query {', operationName: null, internalHash: 'stored' }),
  ).toBe('stored');
});

test('falls back to the stored hash when the body has no operation', () => {
  expect(
    getDocumentInsightsHash({
      body: 'fragment F on User { id }',
      operationName: null,
      internalHash: 'stored',
    }),
  ).toBe('stored');
});
