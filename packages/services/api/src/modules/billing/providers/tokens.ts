import { InjectionToken } from 'graphql-modules';

export type BillingConfig = {
  endpoint: string | null;
};

export const BILLING_CONFIG = new InjectionToken<BillingConfig>('billing-config');
