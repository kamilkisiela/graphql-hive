import { createModule } from 'graphql-modules';
import { ClickHouse } from '../operations/providers/clickhouse-client';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const auditLogModule = createModule({
  id: 'audit-log',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [ClickHouse],
});
