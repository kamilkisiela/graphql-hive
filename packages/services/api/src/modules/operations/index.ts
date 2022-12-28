import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { ClickHouse } from './providers/clickhouse-client';
import { OperationsManager } from './providers/operations-manager';
import { OperationsReader } from './providers/operations-reader';
import { resolvers } from './resolvers';

export const operationsModule = createModule({
  id: 'operations',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [OperationsManager, OperationsReader, ClickHouse],
});
