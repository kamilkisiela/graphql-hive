import { pageSchemaChanges } from '../lib/schema-change-pages';
import type { SchemaChangeGroupResolvers } from './../../../__generated__/types';

export const SchemaChangeGroup: SchemaChangeGroupResolvers = {
  totalCount: group => group.changes.length,
  changes: (group, args) => pageSchemaChanges(group.changes, args),
};
