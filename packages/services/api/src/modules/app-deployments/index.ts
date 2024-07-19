import { createModule } from 'graphql-modules';
import { ClickHouse } from '../operations/providers/clickhouse-client';
import { AppDeployments } from './providers/app-deployments';
import { AppDeploymentsManager } from './providers/app-deployments-manager';
import { PersistedDocumentScheduler } from './providers/persisted-document-scheduler';
import { resolvers } from './resolvers.generated';
import typeDefs from './module.graphql';

export const appDeploymentsModule = createModule({
  id: 'app-deployments',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [AppDeployments, AppDeploymentsManager, ClickHouse, PersistedDocumentScheduler],
});
