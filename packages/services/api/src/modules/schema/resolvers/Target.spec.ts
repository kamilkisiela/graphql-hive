import { buildSchema, execute, parse, type GraphQLResolveInfo } from 'graphql';
import { describe, expect, test } from 'vitest';
import { isFieldRequestedDeep } from '../lib/is-field-requested';
import { isSDLRequested } from './Target';

// The part of the Hive schema the gate looks at: the interface declares schemaSDL,
// previousSchemaSDL and baseline; the composite SDLs live on the concrete types only.
const schema = buildSchema(/* GraphQL */ `
  type Query {
    target: Target
  }
  type Target {
    schemaCheck(id: ID!): SchemaCheck
    schemaVersions: SchemaVersionConnection!
  }
  type SchemaVersionConnection {
    edges: [SchemaVersionEdge!]!
  }
  type SchemaVersionEdge {
    node: SchemaVersion!
  }
  type SchemaVersion {
    id: ID!
    sdl: String
    supergraph: String
    schemaChanges: [String!]
    safeSchemaChanges: [String!]
    supergraphChanges: [String!]
  }
  interface SchemaCheck {
    id: ID!
    schemaSDL: String!
    previousSchemaSDL: String
    baseline: SchemaCheckBaseline
  }
  type SchemaCheckBaseline {
    sdl: String
    publicSdl: String
    supergraphSdl: String
    compositionErrors: [SchemaError!]
    meta: SchemaCheckMeta
  }
  type SchemaCheckMeta {
    commit: String
  }
  type SchemaError {
    message: String!
  }
  type SuccessfulSchemaCheck implements SchemaCheck {
    id: ID!
    schemaSDL: String!
    previousSchemaSDL: String
    baseline: SchemaCheckBaseline
    compositeSchemaSDL: String
    supergraphSDL: String
  }
  type FailedSchemaCheck implements SchemaCheck {
    id: ID!
    schemaSDL: String!
    previousSchemaSDL: String
    baseline: SchemaCheckBaseline
    compositeSchemaSDL: String
    supergraphSDL: String
  }
`);

/** The resolve info Target.schemaCheck receives for the operation. */
async function schemaCheckInfo(operation: string) {
  let info: GraphQLResolveInfo | undefined;
  await execute({
    schema,
    document: parse(operation),
    rootValue: {
      target: {
        schemaCheck(_args: unknown, _context: unknown, resolveInfo: GraphQLResolveInfo) {
          info = resolveInfo;
          return null;
        },
      },
    },
  });
  if (!info) {
    throw new Error('schemaCheck was not resolved');
  }
  return info;
}

/** The resolve info Target.schemaVersions receives for the operation. */
async function schemaVersionsInfo(operation: string) {
  let info: GraphQLResolveInfo | undefined;
  await execute({
    schema,
    document: parse(operation),
    rootValue: {
      target: {
        schemaVersions(_args: unknown, _context: unknown, resolveInfo: GraphQLResolveInfo) {
          info = resolveInfo;
          return { edges: [] };
        },
      },
    },
  });
  if (!info) {
    throw new Error('schemaVersions was not resolved');
  }
  return info;
}

describe('isSDLRequested', () => {
  test('a field with no SDL does not request it', async () => {
    const info = await schemaCheckInfo('{ target { schemaCheck(id: "c") { id } } }');
    expect(isSDLRequested(info)).toBe(false);
  });

  test('previousSchemaSDL selected on the interface requests it', async () => {
    const info = await schemaCheckInfo('{ target { schemaCheck(id: "c") { previousSchemaSDL } } }');
    expect(isSDLRequested(info)).toBe(true);
  });

  test('baseline metadata without its SDLs does not request them', async () => {
    const info = await schemaCheckInfo(
      '{ target { schemaCheck(id: "c") { baseline { compositionErrors { message } meta { commit } } } } }',
    );
    expect(isSDLRequested(info)).toBe(false);
  });

  test('a baseline SDL requests it', async () => {
    const info = await schemaCheckInfo('{ target { schemaCheck(id: "c") { baseline { sdl } } } }');
    expect(isSDLRequested(info)).toBe(true);
  });

  test('a composite SDL under an inline fragment requests it', async () => {
    const info = await schemaCheckInfo(
      '{ target { schemaCheck(id: "c") { ... on SuccessfulSchemaCheck { compositeSchemaSDL } } } }',
    );
    expect(isSDLRequested(info)).toBe(true);
  });

  test('a supergraph SDL under a named fragment requests it', async () => {
    const info = await schemaCheckInfo(`
      { target { schemaCheck(id: "c") { ...Failed } } }
      fragment Failed on FailedSchemaCheck { supergraphSDL }
    `);
    expect(isSDLRequested(info)).toBe(true);
  });
});

describe('schemaVersions selections', () => {
  test('detects SDL and stored changes only when selected', async () => {
    const basicInfo = await schemaVersionsInfo(
      '{ target { schemaVersions { edges { node { id } } } } }',
    );
    const selectedInfo = await schemaVersionsInfo(`
      { target { schemaVersions { edges { node { ...VersionDetails } } } } }
      fragment VersionDetails on SchemaVersion { sdl supergraphChanges }
    `);

    expect(isFieldRequestedDeep(basicInfo, [['SchemaVersion', 'sdl']])).toBe(false);
    expect(isFieldRequestedDeep(basicInfo, [['SchemaVersion', 'supergraphChanges']])).toBe(false);
    expect(isFieldRequestedDeep(selectedInfo, [['SchemaVersion', 'sdl']])).toBe(true);
    expect(isFieldRequestedDeep(selectedInfo, [['SchemaVersion', 'supergraphChanges']])).toBe(true);
    expect(isFieldRequestedDeep(selectedInfo, [['SchemaVersion', 'safeSchemaChanges']])).toBe(
      false,
    );
  });
});
