import { createConnection } from '../../../shared/schema';
import type {
  ActivityConnectionResolvers,
  ResolversTypes,
} from './../../../__generated__/types.next';

const connection = createConnection<ResolversTypes['Activity']>();

export const ActivityConnection: ActivityConnectionResolvers = {
  nodes: connection.nodes,
  total: connection.total,
};
