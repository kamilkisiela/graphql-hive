import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { resolvers } from './resolvers';
import { OperationsManager } from './providers/operations-manager';
import { OperationsReader } from './providers/operations-reader';
import { ClickHouse } from './providers/clickhouse-client';

export const operationsModule = createModule({
  id: 'operations',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [OperationsManager, OperationsReader, ClickHouse],
});
