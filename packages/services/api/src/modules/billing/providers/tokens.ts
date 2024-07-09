import { InjectionToken } from 'graphql-modules';

export type BillingConfig = {
  stripeServiceEndpoint: string | null;
  paddleServiceEndpoint: string | null;
};

export const BILLING_CONFIG = new InjectionToken<BillingConfig>('billing-config');
