import { buildSchema, parse } from 'graphql';
import { md5 } from 'js-md5';
import {
  hashOperation,
  hashOperationIdentity,
  preprocessOperation,
} from '../src/normalize/operation';

const document = parse(/* GraphQL */ `
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
    }
  }
`);

describe('preprocessOperation', () => {
  test('hash depends only on the normalized body and the operation name', () => {
    const withFields = preprocessOperation({
      document,
      schemaCoordinates: ['Query.user', 'Query.user.id', 'User.id', 'User.name', 'ID'],
      operationName: 'GetUser',
    });
    const withProvidedArguments = preprocessOperation({
      document,
      schemaCoordinates: ['Query.user', 'Query.user.id', 'Query.user.id!', 'User.id', 'User.name'],
      operationName: 'GetUser',
    });
    const withoutFields = preprocessOperation({
      document,
      schemaCoordinates: [],
      operationName: 'GetUser',
    });

    expect(withFields?.hash).toBe(withProvidedArguments?.hash);
    expect(withFields?.hash).toBe(withoutFields?.hash);
    expect(withFields?.hash).toBe(
      md5.create().update('query GetUser($id:ID!){user(id:$id){id name}}').update('GetUser').hex(),
    );
  });

  test('hash changes with the operation name', () => {
    const named = preprocessOperation({
      document,
      schemaCoordinates: [],
      operationName: 'GetUser',
    });
    const renamed = preprocessOperation({
      document,
      schemaCoordinates: [],
      operationName: 'Other',
    });

    expect(named?.hash).not.toBe(renamed?.hash);
  });

  test('hash changes with the body', () => {
    const other = parse(/* GraphQL */ `
      query GetUser($id: ID!) {
        user(id: $id) {
          id
        }
      }
    `);
    const a = preprocessOperation({ document, schemaCoordinates: [], operationName: 'GetUser' });
    const b = preprocessOperation({
      document: other,
      schemaCoordinates: [],
      operationName: 'GetUser',
    });

    expect(a?.hash).not.toBe(b?.hash);
  });

  test('falls back to the name in the document', () => {
    const explicit = preprocessOperation({
      document,
      schemaCoordinates: [],
      operationName: 'GetUser',
    });
    const implicit = preprocessOperation({ document, schemaCoordinates: [], operationName: null });

    expect(implicit?.name).toBe('GetUser');
    expect(implicit?.hash).toBe(explicit?.hash);
  });

  test('still expands coordinates to their parent types', () => {
    const result = preprocessOperation({
      document,
      schemaCoordinates: ['Query.user', 'User.name', 'ID'],
      operationName: 'GetUser',
    });

    expect(result?.coordinates).toEqual(['ID', 'Query', 'Query.user', 'User', 'User.name']);
  });

  test('returns null without an operation definition', () => {
    const fragmentOnly = parse(/* GraphQL */ `
      fragment UserFields on User {
        id
      }
    `);

    expect(
      preprocessOperation({ document: fragmentOnly, schemaCoordinates: [], operationName: null }),
    ).toBeNull();
  });
});

describe('hashOperation', () => {
  const schema = buildSchema(/* GraphQL */ `
    type Query {
      user(id: ID!): User
    }

    type User {
      id: ID!
      name: String
    }
  `);

  test('matches the identity of the normalized body and name', () => {
    expect(
      hashOperation({ documentNode: document, variables: null, operationName: 'GetUser', schema }),
    ).toBe(
      hashOperationIdentity({
        body: 'query GetUser($id:ID!){user(id:$id){id name}}',
        operationName: 'GetUser',
      }),
    );
  });

  test('ignores variables', () => {
    const withVariables = hashOperation({
      documentNode: document,
      variables: { id: '1' },
      operationName: 'GetUser',
      schema,
    });
    const withoutVariables = hashOperation({
      documentNode: document,
      variables: null,
      operationName: 'GetUser',
      schema,
    });

    expect(withVariables).toBe(withoutVariables);
  });
});
