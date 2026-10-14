import { encodeSchemaChangeCursor, toSchemaChangePage } from '../lib/schema-change-pages';
import type { SchemaChangeConnectionResolvers } from './../../../__generated__/types';

export const SchemaChangeConnection: SchemaChangeConnectionResolvers = {
  nodes: connection => toSchemaChangePage(connection).page,
  total: connection => toSchemaChangePage(connection).totalCount,
  totalCount: connection => toSchemaChangePage(connection).totalCount,
  edges: connection => {
    const { page, offset } = toSchemaChangePage(connection);
    return page.map((node, index) => ({
      cursor: encodeSchemaChangeCursor(offset + index),
      node,
    }));
  },
  pageInfo: connection => {
    const { page, offset, totalCount } = toSchemaChangePage(connection);
    return {
      startCursor: page.length ? encodeSchemaChangeCursor(offset) : '',
      endCursor: page.length ? encodeSchemaChangeCursor(offset + page.length - 1) : '',
      hasNextPage: offset + page.length < totalCount,
      hasPreviousPage: offset > 0,
    };
  },
};
