import { createModule } from 'graphql-modules';
import { resolvers } from './resolvers';
import { TargetManager } from './providers/target-manager';
import typeDefs from './module.graphql';

export const targetModule = createModule({
  id: 'target',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [TargetManager],
});
