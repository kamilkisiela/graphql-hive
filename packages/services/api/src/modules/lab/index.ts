import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { resolvers } from './resolvers';

export const labModule = createModule({
  id: 'lab',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [],
});
