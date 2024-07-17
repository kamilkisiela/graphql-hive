import { createConnection } from '../../../shared/schema';
import type {
  ProjectConnectionResolvers,
  ResolversTypes,
} from './../../../__generated__/types.next';

const connection = createConnection<ResolversTypes['Project']>();

export const ProjectConnection: ProjectConnectionResolvers = {
  nodes: connection.nodes,
  total: connection.total,
};
