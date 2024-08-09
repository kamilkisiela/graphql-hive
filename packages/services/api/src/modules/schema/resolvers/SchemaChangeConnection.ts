import { createConnection } from '../../../shared/schema';
import type {
  ResolversTypes,
  SchemaChangeConnectionResolvers,
} from './../../../__generated__/types.next';

const connection = createConnection<ResolversTypes['SchemaChange']>();

export const SchemaChangeConnection: SchemaChangeConnectionResolvers = {
  nodes: connection.nodes,
  total: connection.total,
};
