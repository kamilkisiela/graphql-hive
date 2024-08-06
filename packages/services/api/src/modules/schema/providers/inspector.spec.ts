import 'reflect-metadata';
import { buildSchema } from 'graphql';
import { describe, expect, test } from 'vitest';
import { diffSchemaCoordinates } from './inspector';

describe('diffSchemaCoordinates', () => {
  test('should return empty arrays when schemas are equal', () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
      }
    `);

    const result = diffSchemaCoordinates(schema, schema);

    expect(result).toMatchInlineSnapshot(`
      {
        added: Set {},
        deleted: Set {},
        deprecated: Set {},
        undeprecated: Set {},
      }
    `);
  });

  test('field becomes deprecated', () => {
    const before = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
        goodbye: String
      }
    `);
    const after = buildSchema(/* GraphQL */ `
      type Query {
        hello: String @deprecated
        goodbye: String
      }
    `);

    const result = diffSchemaCoordinates(before, after);

    expect(result).toMatchInlineSnapshot(`
      {
        added: Set {},
        deleted: Set {},
        deprecated: Set {
          Query.hello,
        },
        undeprecated: Set {},
      }
    `);
  });

  test('added field is deprecated', () => {
    const before = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
      }
    `);
    const after = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
        hi: String @deprecated
      }
    `);

    const result = diffSchemaCoordinates(before, after);

    expect(result).toMatchInlineSnapshot(`
      {
        added: Set {
          Query.hi,
        },
        deleted: Set {},
        deprecated: Set {
          Query.hi,
        },
        undeprecated: Set {},
      }
    `);
  });

  test('field is deleted', () => {
    const before = buildSchema(/* GraphQL */ `
      type Query {
        goodbye: String
      }
    `);
    const after = buildSchema(/* GraphQL */ `
      type Query {
        hi: String
      }
    `);

    const result = diffSchemaCoordinates(before, after);

    expect(result).toMatchInlineSnapshot(`
      {
        added: Set {
          Query.hi,
        },
        deleted: Set {
          Query.goodbye,
        },
        deprecated: Set {},
        undeprecated: Set {},
      }
    `);
  });

  test('deprecated field is deleted', () => {
    const before = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
        goodbye: String @deprecated
      }
    `);
    const after = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
      }
    `);

    const result = diffSchemaCoordinates(before, after);

    expect(result).toMatchInlineSnapshot(`
      {
        added: Set {},
        deleted: Set {
          Query.goodbye,
        },
        deprecated: Set {},
        undeprecated: Set {},
      }
    `);
  });

  test('deprecated field is undeprecated', () => {
    const before = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
        hi: String @deprecated
      }
    `);
    const after = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
        hi: String
      }
    `);

    const result = diffSchemaCoordinates(before, after);

    expect(result).toMatchInlineSnapshot(`
      {
        added: Set {},
        deleted: Set {},
        deprecated: Set {},
        undeprecated: Set {
          Query.hi,
        },
      }
    `);
  });

  test('deprecated field is undeprecated, undeprecated field is deprecated', () => {
    const before = buildSchema(/* GraphQL */ `
      type Query {
        hello: String @deprecated(reason: "no longer needed")
        bye: String
        goodbye: String
        hi: String @deprecated(reason: "no longer needed")
      }
    `);
    const after = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
        bye: String
        hi: String @deprecated(reason: "no longer needed")
      }
    `);

    const result = diffSchemaCoordinates(before, after);

    expect(result).toMatchInlineSnapshot(`
      {
        added: Set {},
        deleted: Set {
          Query.goodbye,
        },
        deprecated: Set {},
        undeprecated: Set {
          Query.hello,
        },
      }
    `);
  });

  test('removed a deprecated field', () => {
    const before = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
        goodbye: String @deprecated
      }
    `);
    const after = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
      }
    `);

    const result = diffSchemaCoordinates(before, after);

    expect(result).toMatchInlineSnapshot(`
      {
        added: Set {},
        deleted: Set {
          Query.goodbye,
        },
        deprecated: Set {},
        undeprecated: Set {},
      }
    `);
  });

  test('added and removed an argument on deprecated and non-deprecated fields', () => {
    const before = buildSchema(/* GraphQL */ `
      type Query {
        hello(lang: String): String
        hi: String @deprecated
      }
    `);
    const after = buildSchema(/* GraphQL */ `
      type Query {
        hello: String @deprecated
        hi(lang: String): String
      }
    `);

    const result = diffSchemaCoordinates(before, after);

    expect(result).toMatchInlineSnapshot(`
      {
        added: Set {
          Query.hi.lang,
        },
        deleted: Set {
          Query.hello.lang,
        },
        deprecated: Set {
          Query.hello,
        },
        undeprecated: Set {
          Query.hi,
        },
      }
    `);
  });

  test('added removed enum members', () => {
    const before = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
      }
      enum Role {
        ADMIN
        USER
      }
    `);
    const after = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
      }
      enum Role {
        ANONYMOUS
        USER
      }
    `);

    const result = diffSchemaCoordinates(before, after);

    expect(result).toMatchInlineSnapshot(`
      {
        added: Set {
          Role.ANONYMOUS,
        },
        deleted: Set {
          Role.ADMIN,
        },
        deprecated: Set {},
        undeprecated: Set {},
      }
    `);
  });

  test('added removed union members', () => {
    const before = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
      }
      union Account = Admin | User
      type Admin {
        id: ID
      }
      type User {
        id: ID
      }
    `);
    const after = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
      }
      union Account = Anonymous | User
      type Anonymous {
        ip: String
      }
      type User {
        id: ID
      }
    `);

    const result = diffSchemaCoordinates(before, after);

    expect(result).toMatchInlineSnapshot(`
      {
        added: Set {
          Account.Anonymous,
          Anonymous,
          Anonymous.ip,
        },
        deleted: Set {
          Account.Admin,
          Admin,
          Admin.id,
        },
        deprecated: Set {},
        undeprecated: Set {},
      }
    `);
  });

  test('added removed scalars', () => {
    const before = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
      }
      scalar GOODBYE
    `);
    const after = buildSchema(/* GraphQL */ `
      type Query {
        hello: String
      }
      scalar HELLO
    `);

    const result = diffSchemaCoordinates(before, after);

    expect(result).toMatchInlineSnapshot(`
      {
        added: Set {
          HELLO,
        },
        deleted: Set {
          GOODBYE,
        },
        deprecated: Set {},
        undeprecated: Set {},
      }
    `);
  });
});
