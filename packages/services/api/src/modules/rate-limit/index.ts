import { createModule } from 'graphql-modules';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';
import { RateLimitProvider } from './providers/rate-limit.provider';

export const rateLimitModule = createModule({
  id: 'rate-limit',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [RateLimitProvider],
});
