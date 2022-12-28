import { createModule } from 'graphql-modules';
import typeDefs from './module.graphql';
import { BillingProvider } from './providers/billing.provider';
import { resolvers } from './resolvers';

export const billingModule = createModule({
  id: 'billing',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [BillingProvider],
});
