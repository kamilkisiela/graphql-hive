import { buildSchema, parse, TypeInfo } from 'graphql';
import { collectSchemaCoordinates } from '../src/client/collect-schema-coordinates';

describe('collectSchemaCoordinates', () => {
  test('single primitive field schema coordinate', () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
      }
    `);
    const result = collectSchemaCoordinates({
      documentNode: parse(/* GraphQL */ `
        query {
          hello
        }
      `),
      schema,
      processVariables: false,
      variables: null,
      typeInfo: new TypeInfo(schema),
    });

    expect(Array.from(result)).toEqual(['Query.hello']);
  });
  test('two primitive field schema coordinates', () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
        hi: String
      }
    `);
    const result = collectSchemaCoordinates({
      documentNode: parse(/* GraphQL */ `
        query {
          hello
          hi
        }
      `),
      schema,
      processVariables: false,
      variables: null,
      typeInfo: new TypeInfo(schema),
    });

    expect(Array.from(result)).toEqual(['Query.hello', 'Query.hi']);
  });
  test('primitive field with arguments schema coordinates', () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        hello(message: String): String
      }
    `);
    const result = collectSchemaCoordinates({
      documentNode: parse(/* GraphQL */ `
        query {
          hello(message: "world")
        }
      `),
      schema,
      processVariables: false,
      variables: null,
      typeInfo: new TypeInfo(schema),
    });
    expect(Array.from(result)).toEqual(['Query.hello', 'Query.hello.message', 'String']);
  });

  test('leaf field (enum)', () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        hello: Option
      }

      enum Option {
        World
        You
      }
    `);
    const result = collectSchemaCoordinates({
      documentNode: parse(/* GraphQL */ `
        query {
          hello
        }
      `),
      schema,
      processVariables: false,
      variables: null,
      typeInfo: new TypeInfo(schema),
    });

    expect(Array.from(result)).toEqual(['Query.hello', 'Option.World', 'Option.You']);
  });

  test('collected fields of interface selection set does not contain exact resolutions (User.id, Animal.id)', () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        node: Node
      }

      interface Node {
        id: ID!
      }

      type User implements Node {
        id: ID!
      }

      type Animal implements Node {
        id: ID!
      }
    `);
    const result = collectSchemaCoordinates({
      documentNode: parse(/* GraphQL */ `
        query {
          node {
            id
          }
        }
      `),
      schema,
      processVariables: false,
      variables: null,
      typeInfo: new TypeInfo(schema),
    });
    expect(Array.from(result)).toEqual(['Query.node', 'Node.id']);
  });
  test('collected fields contain exact resolutions on inline fragment spread', () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        node: Node
      }

      interface Node {
        id: ID!
      }

      type User implements Node {
        id: ID!
      }

      type Animal implements Node {
        id: ID!
      }
    `);
    const result = collectSchemaCoordinates({
      documentNode: parse(/* GraphQL */ `
        query {
          node {
            id
            ... on User {
              id
            }
          }
        }
      `),
      schema,
      processVariables: false,
      variables: null,
      typeInfo: new TypeInfo(schema),
    });
    expect(Array.from(result)).toEqual(['Query.node', 'Node.id', 'User.id']);
  });
});
