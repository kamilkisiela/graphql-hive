import { createModule } from 'graphql-modules';
import { TargetManager } from './providers/target-manager';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const targetModule = createModule({
  id: 'target',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [TargetManager],
});
