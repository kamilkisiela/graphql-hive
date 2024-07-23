import { createConnection } from '../../../shared/schema';
import type { ResolversTypes, UserConnectionResolvers } from './../../../__generated__/types.next';

const connection = createConnection<ResolversTypes['User']>();

export const UserConnection: UserConnectionResolvers = {
  nodes: connection.nodes,
  total: connection.total,
};
