import { createConnection } from '../../../shared/schema';
import type {
  OperationStatsValuesConnectionResolvers,
  ResolversTypes,
} from './../../../__generated__/types.next';

const connection = createConnection<ResolversTypes['OperationStatsValues']>();

export const OperationStatsValuesConnection: OperationStatsValuesConnectionResolvers = {
  nodes: connection.nodes,
  total: connection.total,
};
