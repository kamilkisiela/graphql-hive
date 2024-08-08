import type { BillingDetailsResolvers } from './../../../__generated__/types.next';

export const BillingDetails: BillingDetailsResolvers = {
  city: bd => bd.address?.city || null,
  country: bd => bd.address?.country || null,
  line1: bd => bd.address?.line1 || null,
  line2: bd => bd.address?.line2 || null,
  postalCode: bd => bd.address?.postal_code ?? null,
  state: bd => bd.address?.state || null,
};
