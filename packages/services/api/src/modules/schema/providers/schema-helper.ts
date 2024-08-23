import { createHash } from 'node:crypto';
import { DocumentNode, print, visit } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import objectHash from 'object-hash';
import type {
  CompositeSchema,
  PushedCompositeSchema,
  Schema,
  SchemaObject,
  SingleSchema,
} from '../../../shared/entities';
import { createSchemaObject } from '../../../shared/entities';
import { cache } from '../../../shared/helpers';
import { sortDocumentNode } from '../../../shared/schema';

export function isSingleSchema(schema: Schema): schema is SingleSchema {
  return schema.kind === 'single';
}

export function isCompositeSchema(schema: Schema): schema is CompositeSchema {
  return schema.kind === 'composite';
}

export function ensureSingleSchema(schema: Schema | Schema[]): SingleSchema {
  if (Array.isArray(schema)) {
    if (schema.length > 1) {
      throw new Error(`Expected a single schema, got ${schema.length}`);
    }

    return ensureSingleSchema(schema[0]);
  }

  if (isSingleSchema(schema)) {
    return schema;
  }

  throw new Error('Expected a single schema');
}

export function ensureCompositeSchemas(schemas: readonly Schema[]): CompositeSchema[] | never {
  return schemas.filter(isCompositeSchema);
}

export function serviceExists(schemas: CompositeSchema[], serviceName: string) {
  return schemas.some(s => s.service_name === serviceName);
}

export function swapServices(
  schemas: CompositeSchema[],
  newSchema: CompositeSchema,
): {
  schemas: CompositeSchema[];
  existing: CompositeSchema | null;
} {
  let swapped: CompositeSchema | null = null;
  const output = schemas.map(existing => {
    if (existing.service_name === newSchema.service_name) {
      swapped = existing;
      return newSchema;
    }

    return existing;
  });

  if (!swapped) {
    output.push(newSchema);
  }

  return {
    schemas: output,
    existing: swapped,
  };
}

export function extendWithBase(
  schemas: CompositeSchema[] | [SingleSchema],
  baseSchema: string | null,
) {
  if (!baseSchema) {
    return schemas;
  }

  return schemas.map((schema, index) => {
    if (index === 0) {
      return {
        ...schema,
        source: baseSchema + ' ' + schema.sdl,
      };
    }

    return schema;
  });
}

export function removeDescriptions(documentNode: DocumentNode): DocumentNode {
  return visit(documentNode, {
    enter(node) {
      if ('description' in node) {
        return {
          ...node,
          description: null,
        };
      }
    },
  });
}

type CreateSchemaObjectInput = Parameters<typeof createSchemaObject>[0];

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SchemaHelper {
  @cache<CreateSchemaObjectInput>(schema => JSON.stringify(schema))
  createSchemaObject(schema: CreateSchemaObjectInput): SchemaObject {
    return createSchemaObject(schema);
  }

  createChecksum(schema: SingleSchema | PushedCompositeSchema): string {
    const hasher = createHash('md5');

    hasher.update(print(sortDocumentNode(this.createSchemaObject(schema).document)), 'utf-8');
    hasher.update(
      `service_name: ${
        'service_name' in schema && typeof schema.service_name === 'string'
          ? schema.service_name
          : ''
      }`,
      'utf-8',
    );
    hasher.update(
      `service_url: ${
        'service_url' in schema && typeof schema.service_url === 'string' ? schema.service_url : ''
      }`,
      'utf-8',
    );
    hasher.update(
      `metadata: ${
        'metadata' in schema && schema.metadata ? objectHash(JSON.parse(schema.metadata)) : ''
      }`,
      'utf-8',
    );

    return hasher.digest('hex');
  }
}
