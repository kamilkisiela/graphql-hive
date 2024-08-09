import { SchemaManager } from '../../providers/schema-manager';
import type { QueryResolvers } from './../../../../__generated__/types.next';

export const schemaVersionForActionId: NonNullable<
  QueryResolvers['schemaVersionForActionId']
> = async (_, { actionId }, { injector }) => {
  return injector.get(SchemaManager).getSchemaVersionByActionId({
    actionId,
  });
};
