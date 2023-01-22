import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { resolvers } from './resolvers';

export const sharedModule = createModule({
  id: 'shared',
  dirname: __dirname,
  typeDefs,
  resolvers,
});
