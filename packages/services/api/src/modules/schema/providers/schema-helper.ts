import { createHash } from 'crypto';
import { print } from 'graphql';
import { Injectable, Scope } from 'graphql-modules';
import type { Schema, SchemaObject } from '../../../shared/entities';
import { createSchemaObject } from '../../../shared/entities';
import { cache } from '../../../shared/helpers';
import { sortDocumentNode } from '../../../shared/schema';

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
