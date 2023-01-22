import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { TokenManager } from './providers/token-manager';
import { TokenStorage } from './providers/token-storage';
import { resolvers } from './resolvers';

export const tokenModule = createModule({
  id: 'token',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [TokenManager, TokenStorage],
});
