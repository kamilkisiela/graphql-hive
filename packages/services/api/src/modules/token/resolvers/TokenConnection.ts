import { createConnection } from '../../../shared/schema';
import type { ResolversTypes, TokenConnectionResolvers } from './../../../__generated__/types.next';

const connection = createConnection<ResolversTypes['Token']>();

export const TokenConnection: TokenConnectionResolvers = {
  nodes: connection.nodes,
  total: connection.total,
};
