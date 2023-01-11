import { createModule } from 'graphql-modules';
import { UsageEstimationProvider } from './providers/usage-estimation.provider';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const usageEstimationModule = createModule({
  id: 'usage-estimation',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [UsageEstimationProvider],
});
