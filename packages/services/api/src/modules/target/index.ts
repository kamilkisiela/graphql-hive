import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { TargetManager } from './providers/target-manager';
import { resolvers } from './resolvers';

export const targetModule = createModule({
  id: 'target',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [TargetManager],
});
