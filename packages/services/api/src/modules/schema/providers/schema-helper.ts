import { createHash } from 'node:crypto';
import {
  DefinitionNode,
  DocumentNode,
  isTypeDefinitionNode,
  isTypeExtensionNode,
  Kind,
  print,
  visit,
} from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import objectHash from 'object-hash';
import type {
  CompositeSchema,
  CreateSchemaObjectInput,
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

export function ensureCompositeSchemas(schemas: readonly Schema[]): CompositeSchema[] {
  return schemas.filter(isCompositeSchema);
}

export function serviceExists(schemas: CompositeSchema[], serviceName: string) {
  return schemas.some(s => s.service_name === serviceName);
}

export function swapServices(
  schemas: CompositeSchemaInput[],
  newSchema: CompositeSchemaInput,
): {
  schemas: CompositeSchemaInput[];
  existing: CompositeSchemaInput | null;
} {
  let swapped: CompositeSchemaInput | null = null;
  const output = schemas.map(existing => {
    if (existing.serviceName === newSchema.serviceName) {
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

export function extendWithBase(schemas: Array<SchemaInput>, baseSchema: string | null) {
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

const extensionToDefinitionKindMap = {
  [Kind.OBJECT_TYPE_EXTENSION]: Kind.OBJECT_TYPE_DEFINITION,
  [Kind.INPUT_OBJECT_TYPE_EXTENSION]: Kind.INPUT_OBJECT_TYPE_DEFINITION,
  [Kind.INTERFACE_TYPE_EXTENSION]: Kind.INTERFACE_TYPE_DEFINITION,
  [Kind.UNION_TYPE_EXTENSION]: Kind.UNION_TYPE_DEFINITION,
  [Kind.ENUM_TYPE_EXTENSION]: Kind.ENUM_TYPE_DEFINITION,
  [Kind.SCALAR_TYPE_EXTENSION]: Kind.SCALAR_TYPE_DEFINITION,
} as const;

export function addTypeForExtensions(ast: DocumentNode) {
  const trackTypeDefs = new Map<
    string,
    | {
        state: 'TYPE_ONLY';
      }
    | {
        state: 'EXTENSION_ONLY' | 'VALID_EXTENSION';
        kind:
          | Kind.OBJECT_TYPE_EXTENSION
          | Kind.ENUM_TYPE_EXTENSION
          | Kind.UNION_TYPE_EXTENSION
          | Kind.SCALAR_TYPE_EXTENSION
          | Kind.INTERFACE_TYPE_EXTENSION
          | Kind.INPUT_OBJECT_TYPE_EXTENSION;
      }
  >();
  for (const node of ast.definitions) {
    if ('name' in node && node.name) {
      const name = node.name.value;
      const entry = trackTypeDefs.get(name);
      if (isTypeExtensionNode(node)) {
        if (!entry) {
          trackTypeDefs.set(name, { state: 'EXTENSION_ONLY', kind: node.kind });
        } else if (entry.state === 'TYPE_ONLY') {
          trackTypeDefs.set(name, { kind: node.kind, state: 'VALID_EXTENSION' });
        }
      } else if (isTypeDefinitionNode(node)) {
        if (!entry) {
          trackTypeDefs.set(name, { state: 'TYPE_ONLY' });
        } else if (entry.state === 'EXTENSION_ONLY') {
          trackTypeDefs.set(name, { ...entry, state: 'VALID_EXTENSION' });
        }
      }
    }
  }

  const astCopy = visit(ast, {});
  for (const [name, entry] of trackTypeDefs) {
    if (entry.state === 'EXTENSION_ONLY') {
      (astCopy.definitions as DefinitionNode[]).push({
        kind: extensionToDefinitionKindMap[entry.kind],
        name: {
          kind: Kind.NAME,
          value: name,
        },
      });
    }
  }
  return astCopy;
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

  createChecksum(schema: SchemaInput): string {
    const hasher = createHash('md5');

    hasher.update(print(sortDocumentNode(this.createSchemaObject(schema).document)), 'utf-8');
    hasher.update(`service_name: ${schema.serviceName ?? ''}`, 'utf-8');
    hasher.update(`service_url: ${schema.serviceUrl ?? ''}`, 'utf-8');
    hasher.update(`metadata: ${hashMetadata(schema.metadata)}`, 'utf-8');

    return hasher.digest('hex');
  }
}

/**
 * Metadata that is not valid JSON is rejected by the metadata check,
 * so it only needs a checksum that differs from any stored metadata.
 */
function hashMetadata(metadata: string | null | undefined): string {
  if (!metadata) {
    return '';
  }

  try {
    return objectHash(JSON.parse(metadata));
  } catch {
    return objectHash(metadata);
  }
}

export function toCompositeSchemaInput(schema: PushedCompositeSchema): CompositeSchemaInput {
  return {
    id: schema.id,
    metadata: schema.metadata,
    sdl: schema.sdl,
    serviceName: schema.service_name,
    // service_url can be null for very old records from 2023
    // The default value mapping should happen on the database read level
    // but right now we are doing that here until we refactor the database read level (Storage class)
    serviceUrl: schema.service_url ?? '',
  };
}

export function toSingleSchemaInput(schema: SingleSchema): SingleSchemaInput {
  return {
    id: schema.id,
    metadata: schema.metadata,
    sdl: schema.sdl,
    // Note: due to a "bug" we inserted service_name for single schemas into the schema_log table.
    // We set it explicitly to null to avoid any confusion in other parts of the business logic
    serviceName: null,
    serviceUrl: null,
  };
}

export type CompositeSchemaInput = {
  id: string;
  sdl: string;
  serviceName: string;
  serviceUrl: string;
  metadata: string | null;
};

export type SingleSchemaInput = {
  id: string;
  sdl: string;
  serviceName: null;
  serviceUrl: null;
  metadata: string | null;
};

export type SchemaInput = CompositeSchemaInput | SingleSchemaInput;
