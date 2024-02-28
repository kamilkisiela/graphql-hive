import { createModule } from 'graphql-modules';
import { InMemoryRateLimiter, InMemoryRateLimitStore } from './providers/in-memory-rate-limiter';
import { RateLimitProvider } from './providers/rate-limit.provider';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const rateLimitModule = createModule({
  id: 'rate-limit',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [RateLimitProvider, InMemoryRateLimitStore, InMemoryRateLimiter],
});
