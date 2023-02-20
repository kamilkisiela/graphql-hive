import { env } from '@/env/frontend';

export const getStripePublicKey = () => {
  const { stripePublicKey } = env;
  if (!stripePublicKey) {
    return null;
  }
  return stripePublicKey;
};

export const getIsStripeEnabled = () => !!getStripePublicKey();
