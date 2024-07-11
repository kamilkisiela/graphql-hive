import { createConnection } from '../../../shared/schema';
import type {
  MemberConnectionResolvers,
  ResolversTypes,
} from './../../../__generated__/types.next';

const connection = createConnection<ResolversTypes['Member']>();

export const MemberConnection: MemberConnectionResolvers = {
  nodes: connection.nodes,
  total: connection.total,
};
