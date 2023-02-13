import { createModule } from 'graphql-modules';
import { PersistedOperationManager } from './providers/persisted-operation-manager';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const persistedOperationModule = createModule({
  id: 'persisted-operations',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [PersistedOperationManager],
});
