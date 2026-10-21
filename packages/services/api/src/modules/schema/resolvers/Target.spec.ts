import { buildSchema, execute, parse, type GraphQLResolveInfo } from 'graphql';
import { describe, expect, test } from 'vitest';
import { areOnlyFieldsRequested, isFieldRequestedDeep } from '../lib/graphql-info-helper';
import {
  areSchemaCheckChangesRequested,
  isSchemaVersionSDLRequested,
  isSDLRequested,
} from './Target';

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
    explorer: String
    unusedSchema: String
    deprecatedSchema: String
    schemaChanges: [String!]
    safeSchemaChanges: [String!]
    supergraphChanges: [String!]
    schemas: SchemaConnection!
  }
  type SchemaConnection {
    edges: [SchemaEdge!]!
  }
  type SchemaEdge {
    node: Schema!
  }
  union Schema = SingleSchema | CompositeSchema
  type SingleSchema {
    author: String!
    source: String!
  }
  type CompositeSchema {
    author: String!
    source: String!
    service: String
  }
  interface SchemaCheck {
    id: ID!
    schemaVersion: SchemaVersion
    schemaSDL: String!
    previousSchemaSDL: String
    baseline: SchemaCheckBaseline
    schemaChanges: [String!]
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
    schemaVersion: SchemaVersion
    schemaSDL: String!
    previousSchemaSDL: String
    baseline: SchemaCheckBaseline
    compositeSchemaSDL: String
    supergraphSDL: String
    schemaChanges: [String!]
    safeSchemaChanges: [String!]
    safeSchemaChangeGroups: [String!]!
  }
  type FailedSchemaCheck implements SchemaCheck {
    id: ID!
    schemaVersion: SchemaVersion
    schemaSDL: String!
    previousSchemaSDL: String
    baseline: SchemaCheckBaseline
    compositeSchemaSDL: String
    supergraphSDL: String
    schemaChanges: [String!]
    breakingSchemaChanges: [String!]
    unapprovedBreakingSchemaChangeCount: Int!
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

describe('schemaVersion ID selection', () => {
  test('detects an ID-only selection through a fragment', async () => {
    const info = await schemaCheckInfo(`
      { target { schemaCheck(id: "c") { schemaVersion { ...VersionId } } } }
      fragment VersionId on SchemaVersion { __typename id }
    `);

    expect(areOnlyFieldsRequested(info, 'SchemaVersion', new Set(['id', '__typename']))).toBe(true);
  });

  test('rejects a selection with another version field', async () => {
    const info = await schemaCheckInfo(
      '{ target { schemaCheck(id: "c") { schemaVersion { id sdl } } } }',
    );

    expect(areOnlyFieldsRequested(info, 'SchemaVersion', new Set(['id', '__typename']))).toBe(
      false,
    );
  });
});

describe('schema check change selections', () => {
  test('does not request changes for unrelated fields', async () => {
    const info = await schemaCheckInfo('{ target { schemaCheck(id: "c") { id } } }');
    expect(areSchemaCheckChangesRequested(info)).toBe(false);
  });

  test('requests changes for derived change fields', async () => {
    const info = await schemaCheckInfo(`
      { target { schemaCheck(id: "c") {
        ... on SuccessfulSchemaCheck { safeSchemaChangeGroups }
        ... on FailedSchemaCheck { unapprovedBreakingSchemaChangeCount }
      } } }
    `);
    expect(areSchemaCheckChangesRequested(info)).toBe(true);
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

  test.each(['sdl', 'supergraph', 'explorer', 'unusedSchema', 'deprecatedSchema'])(
    'loads SDL when %s is selected',
    async fieldName => {
      const info = await schemaVersionsInfo(`
        { target { schemaVersions { edges { node { ${fieldName} } } } } }
      `);

      expect(isSchemaVersionSDLRequested(info)).toBe(true);
    },
  );

  test('detects schema SDL only when source is selected', async () => {
    const metadataInfo = await schemaVersionsInfo(`
      { target { schemaVersions { edges { node { schemas { edges { node {
        ... on CompositeSchema { author service }
      } } } } } } } }
    `);
    const sourceInfo = await schemaVersionsInfo(`
      { target { schemaVersions { edges { node { schemas { edges { node {
        ... on SingleSchema { source }
      } } } } } } } }
    `);
    const sourceFields = [
      ['SingleSchema', 'source'],
      ['CompositeSchema', 'source'],
    ] as const;

    expect(isFieldRequestedDeep(metadataInfo, sourceFields)).toBe(false);
    expect(isFieldRequestedDeep(sourceInfo, sourceFields)).toBe(true);
  });
});
