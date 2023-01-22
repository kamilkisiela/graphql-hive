import { createModule } from 'graphql-modules';
import { ClickHouse } from './providers/clickhouse-client';
import { OperationsManager } from './providers/operations-manager';
import { OperationsReader } from './providers/operations-reader';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const operationsModule = createModule({
  id: 'operations',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [OperationsManager, OperationsReader, ClickHouse],
});
