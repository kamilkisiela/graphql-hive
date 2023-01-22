import { createModule } from 'graphql-modules';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const labModule = createModule({
  id: 'lab',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [],
});
