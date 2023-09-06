import { createModule } from 'graphql-modules';
import { SupportManager } from './providers/support-manager';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const supportModule = createModule({
  id: 'support',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [SupportManager],
});
