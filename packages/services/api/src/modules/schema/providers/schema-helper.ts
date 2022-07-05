import { Injectable, Scope } from 'graphql-modules';
import { print } from 'graphql';
import { createHash } from 'crypto';
import { createSchemaObject } from '../../../shared/entities';
import type { Schema, SchemaObject } from '../../../shared/entities';
import { sortDocumentNode } from '../../../shared/schema';
import { cache } from '../../../shared/helpers';

@Injectable({
  scope: Scope.Operation,
  global: true,
})
export class SchemaHelper {
  @cache<Schema>(schema => JSON.stringify(schema))
  createSchemaObject(schema: Schema): SchemaObject {
    return createSchemaObject(schema);
  }

  sortSchemas(schemas: Schema[]) {
    return schemas.sort((a, b) => (a.service ?? '').localeCompare(b.service ?? ''));
  }

  createChecksum(schema: SchemaObject): string {
    return createHash('md5')
      .update(print(sortDocumentNode(schema.document)), 'utf-8')
      .digest('hex');
  }
}
