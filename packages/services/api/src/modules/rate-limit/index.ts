import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { RateLimitProvider } from './providers/rate-limit.provider';
import { resolvers } from './resolvers';

export const rateLimitModule = createModule({
  id: 'rate-limit',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [RateLimitProvider],
});
