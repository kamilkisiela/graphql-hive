import { createModule } from 'graphql-modules';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';
import { UsageEstimationProvider } from './providers/usage-estimation.provider';

export const usageEstimationModule = createModule({
  id: 'usage-estimation',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [UsageEstimationProvider],
});
