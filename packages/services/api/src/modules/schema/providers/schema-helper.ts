import { createHash } from 'crypto';
import { parse, print } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import objectHash from 'object-hash';
import type {
  ComposeAndValidateResult,
  CompositeSchema,
  PushedCompositeSchema,
  Schema,
  SchemaObject,
  SingleSchema,
} from '../../../shared/entities';
import { createSchemaObject } from '../../../shared/entities';
import { cache } from '../../../shared/helpers';
import { sortDocumentNode } from '../../../shared/schema';
import { SchemaBuildError } from './orchestrators/errors';

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

type CreateSchemaObjectInput = Parameters<typeof createSchemaObject>[0];

export async function ensureSDL(
  composeAndValidationResultPromise: Promise<ComposeAndValidateResult>,
  strategy: 'reject-on-graphql-errors' | 'ignore-errors' = 'ignore-errors',
) {
  const composeAndValidationResult = await composeAndValidationResultPromise;

  if (strategy === 'reject-on-graphql-errors') {
    if (composeAndValidationResult.errors.length) {
      throw new SchemaBuildError(
        `Composition errors: \n` +
          composeAndValidationResult.errors.map(err => ` - ${err.message}`).join('\n'),
        composeAndValidationResult.errors,
      );
    }
  }

  if (!composeAndValidationResult.sdl) {
    if (composeAndValidationResult.errors.length) {
      throw new SchemaBuildError(
        `Composition errors: \n` +
          composeAndValidationResult.errors.map(err => ` - ${err.message}`).join('\n'),
        composeAndValidationResult.errors,
      );
    }

    throw new Error('Expected to find SDL');
  }

  try {
    return {
      document: parse(composeAndValidationResult.sdl),
      raw: composeAndValidationResult.sdl,
    };
  } catch (error) {
    throw new SchemaBuildError(`Failed to parse schema: ${String(error)}`, [
      {
        message: String(error),
        source: 'graphql',
      },
    ]);
  }
}

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SchemaHelper {
  @cache<CreateSchemaObjectInput>(schema => JSON.stringify(schema))
  createSchemaObject(schema: CreateSchemaObjectInput): SchemaObject {
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
