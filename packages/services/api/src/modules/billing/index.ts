import { createModule } from 'graphql-modules';
import { BillingProvider } from './providers/billing.provider';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const billingModule = createModule({
  id: 'billing',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [BillingProvider],
});
