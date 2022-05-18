import { createModule } from 'graphql-modules';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';
import { TokenManager } from './providers/token-manager';
import { TokenStorage } from './providers/token-storage';

export const tokenModule = createModule({
  id: 'token',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [TokenManager, TokenStorage],
});
