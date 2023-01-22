import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { PersistedOperationManager } from './providers/persisted-operation-manager';
import { resolvers } from './resolvers';

export const persistedOperationModule = createModule({
  id: 'persisted-operations',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [PersistedOperationManager],
});
