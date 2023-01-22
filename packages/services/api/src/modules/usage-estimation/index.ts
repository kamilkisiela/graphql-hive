import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { UsageEstimationProvider } from './providers/usage-estimation.provider';
import { resolvers } from './resolvers';

export const usageEstimationModule = createModule({
  id: 'usage-estimation',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [UsageEstimationProvider],
});
