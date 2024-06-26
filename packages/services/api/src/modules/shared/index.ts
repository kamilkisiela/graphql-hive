import { createModule } from 'graphql-modules';
import { resolvers } from './resolvers.generated';
import typeDefs from './module.graphql';

export const sharedModule = createModule({
  id: 'shared',
  dirname: __dirname,
  typeDefs,
  resolvers,
});
