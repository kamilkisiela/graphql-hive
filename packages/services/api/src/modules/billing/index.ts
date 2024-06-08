import { createModule } from 'graphql-modules';
import { BillingProvider } from './providers/billing.provider';
import { PaddleBillingProvider } from './providers/paddle-billing.provider';
import { StripeBillingProvider } from './providers/stripe-billing.provider';
import { resolvers } from './resolvers';
import typeDefs from './module.graphql';

export const billingModule = createModule({
  id: 'billing',
  dirname: __dirname,
  typeDefs,
  resolvers,
  providers: [BillingProvider, PaddleBillingProvider, StripeBillingProvider],
});
