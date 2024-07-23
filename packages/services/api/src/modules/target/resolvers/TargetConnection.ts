import { createConnection } from '../../../shared/schema';
import type {
  ResolversTypes,
  TargetConnectionResolvers,
} from './../../../__generated__/types.next';

const connection = createConnection<ResolversTypes['Target']>();

export const TargetConnection: TargetConnectionResolvers = {
  nodes: connection.nodes,
  total: connection.total,
};
