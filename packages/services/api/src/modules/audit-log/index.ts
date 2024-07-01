import { createModule } from 'graphql-modules';

import { resolvers } from './resolvers';
import typeDefs from './module.graphql';
import { ClickHouse } from '../operations/providers/clickhouse-client';

export const authModule = createModule({
  id: 'audit-log',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [
    ClickHouse
  ],
});
