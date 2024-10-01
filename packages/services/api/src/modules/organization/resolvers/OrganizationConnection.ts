import { createConnection } from '../../../shared/schema';
import type {
  OrganizationConnectionResolvers,
  ResolversTypes,
} from './../../../__generated__/types.next';

const connection = createConnection<ResolversTypes['Organization']>();

export const OrganizationConnection: OrganizationConnectionResolvers = {
  nodes: connection.nodes,
  total: connection.total,
};
