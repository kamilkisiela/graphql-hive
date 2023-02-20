import { createModule } from 'graphql-modules';
import { AdminManager } from './providers/admin-manager';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const adminModule = createModule({
  id: 'admin',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [AdminManager],
});
