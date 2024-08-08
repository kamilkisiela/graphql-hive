import type { BillingPaymentMethodResolvers } from './../../../__generated__/types.next';

export const BillingPaymentMethod: BillingPaymentMethodResolvers = {
  brand: bpm => bpm.brand,
  last4: bpm => bpm.last4,
  expMonth: bpm => bpm.exp_month,
  expYear: bpm => bpm.exp_year,
};
