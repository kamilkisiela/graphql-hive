import { createConnection } from '../../../shared/schema';
import type {
  ResolversTypes,
  SchemaConnectionResolvers,
} from './../../../__generated__/types.next';

const connection = createConnection<ResolversTypes['Schema']>();

export const SchemaConnection: SchemaConnectionResolvers = {
  nodes: connection.nodes,
  total: connection.total,
};
