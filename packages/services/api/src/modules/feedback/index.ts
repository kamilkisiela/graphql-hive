import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { resolvers } from './resolvers';

export const feedbackModule = createModule({
  id: 'feedback',
  dirname: __dirname,
  typeDefs,
  resolvers,
});
