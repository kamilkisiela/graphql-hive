import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { AdminManager } from './providers/admin-manager';
import { resolvers } from './resolvers';

export const adminModule = createModule({
  id: 'admin',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [AdminManager],
});
