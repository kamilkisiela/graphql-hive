import { createHash } from 'crypto';
import { print } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import objectHash from 'object-hash';
import type {
  CompositeSchema,
  DeletedCompositeSchema,
  PushedCompositeSchema,
  Schema,
  SchemaObject,
  SingleSchema,
} from '../../../shared/entities';
import { createSchemaObject, PushedCompositeSchemaModel } from '../../../shared/entities';
import { cache } from '../../../shared/helpers';
import { sortDocumentNode } from '../../../shared/schema';

export function isPushedCompositeSchema(schema: Schema): schema is PushedCompositeSchema {
  return schema.kind === 'composite' && schema.action === 'PUSH';
}

export function isDeletedCompositeSchema(schema: Schema): schema is DeletedCompositeSchema {
  return schema.kind === 'composite' && schema.action === 'DELETE';
}

export function isSingleSchema(schema: Schema): schema is SingleSchema {
  return schema.kind === 'single';
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

export function ensurePushedCompositeSchemas(
  schemas: readonly Schema[],
): PushedCompositeSchema[] | never {
  return schemas.map(schema => PushedCompositeSchemaModel.parse(schema));
}

export function isSchemaWithSDL(schema: Schema): schema is PushedCompositeSchema | SingleSchema {
  return 'sdl' in schema && typeof schema.sdl === 'string';
}

export function ensureSchemaWithSDL(schema: Schema): PushedCompositeSchema | SingleSchema | never {
  if (isSchemaWithSDL(schema)) {
    return schema;
  }

  throw new Error('Schema does not have an SDL');
}

export function selectPushedCompositeSchemas(schemas: readonly Schema[]) {
  return schemas.filter(isPushedCompositeSchema);
}

export function selectDeletedCompositeSchemas(schemas: readonly Schema[]) {
  return schemas.filter(isDeletedCompositeSchema);
}

export function selectSchemaWithSDL(schemas: readonly Schema[]) {
  return schemas.filter(isSchemaWithSDL);
}

export function serviceExists(schemas: CompositeSchema[], serviceName: string) {
  return schemas.some(s => s.service_name === serviceName);
}

export function swapServices(
  schemas: PushedCompositeSchema[],
  newSchema: PushedCompositeSchema,
): {
  schemas: PushedCompositeSchema[];
  existing: PushedCompositeSchema | null;
} {
  let swapped: PushedCompositeSchema | null = null;
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

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SchemaHelper {
  @cache<SingleSchema | PushedCompositeSchema>(schema => JSON.stringify(schema))
  createSchemaObject(schema: SingleSchema | PushedCompositeSchema): SchemaObject {
    return createSchemaObject(schema);
  }

  sortSchemas(schemas: CompositeSchema[]) {
    return schemas.sort((a, b) => (a.service_name ?? '').localeCompare(b.service_name ?? ''));
  }

  createChecksum(schema: SingleSchema | PushedCompositeSchema): string {
    return this.createChecksumFromSchemas([schema] as [SingleSchema] | PushedCompositeSchema[]);
  }

  createChecksumFromSchemas(schemas: [SingleSchema] | PushedCompositeSchema[]): string {
    const hasher = createHash('md5');

    for (const schema of schemas) {
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
          'service_url' in schema && typeof schema.service_url === 'string'
            ? schema.service_url
            : ''
        }`,
        'utf-8',
      );
      hasher.update(
        `metadata: ${
          'metadata' in schema && schema.metadata ? objectHash(JSON.parse(schema.metadata)) : ''
        }`,
        'utf-8',
      );
    }

    return hasher.digest('hex');
  }

  compare({
    schemas,
    latestVersion,
  }: {
    schemas: [SingleSchema] | PushedCompositeSchema[];
    latestVersion: {
      isComposable: boolean;
      schemas: [SingleSchema] | PushedCompositeSchema[];
    } | null;
  }) {
    const isInitial = latestVersion === null;

    if (isInitial) {
      return 'initial' as const;
    }

    const isModified =
      this.createChecksumFromSchemas(schemas) !==
      this.createChecksumFromSchemas(latestVersion.schemas);

    if (!isModified) {
      return 'unchanged' as const;
    }

    return 'modified' as const;
  }
}
