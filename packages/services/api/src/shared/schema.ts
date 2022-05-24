import { createHash } from 'crypto';
import { buildASTSchema, GraphQLSchema, lexicographicSortSchema } from 'graphql';
import { Schema, SchemaObject, emptySource } from './entities';

export function hashSchema(schema: Schema): string {
  return createHash('md5').update(schema.source, 'utf-8').digest('hex');
}

/**
 * Builds GraphQLSchema without validation of SDL
 */
export function buildSchema(schema: SchemaObject): GraphQLSchema {
  return lexicographicSortSchema(
    buildASTSchema(schema.document, {
      assumeValid: true,
      assumeValidSDL: true,
    })
  );
}

export function findSchema(schemas: readonly Schema[], expected: Schema): Schema | undefined {
  return schemas.find(schema => schema.service === expected.service);
}

export function updateSchemas(
  schemas: readonly Schema[],
  incoming: Schema
): {
  schemas: readonly Schema[];
  swappedSchema: Schema | null;
} {
  let swappedSchema: Schema | null = null;
  const newSchemas = schemas.map(schema => {
    const matching = (schema.service ?? emptySource) === (incoming.service ?? emptySource);

    if (matching) {
      swappedSchema = schema;
      return incoming;
    }

    return schema;
  });

  if (!swappedSchema) {
    newSchemas.push(incoming);
  }

  return {
    schemas: newSchemas,
    swappedSchema,
  };
}

export function minifySchema(schema: string): string {
  return schema.replace(/\s+/g, ' ').trim();
}

export function createConnection<T>() {
  return {
    nodes(nodes: readonly T[]) {
      return nodes ?? [];
    },
    total(nodes: readonly T[]) {
      return nodes?.length ?? 0;
    },
  };
}
