import { pageSchemaChanges } from '../lib/schema-change-pages';
import type { SchemaChangeGroupResolvers } from './../../../__generated__/types';

export const SchemaChangeGroup: SchemaChangeGroupResolvers = {
  // Explicit so the compiler checks every stored change type is in the SchemaChangeKind enum.
  kind: group => group.kind,
  totalCount: group => group.changes.length,
  changes: (group, args) => pageSchemaChanges(group.changes, args),
};
