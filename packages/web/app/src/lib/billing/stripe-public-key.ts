import { env } from '@/env/frontend';

export const getStripePublicKey = () => {
  const stripePublicKey = env.stripePublicKey;
  if (!stripePublicKey) {
    return null;
  }
  return stripePublicKey;
};

export const getIsStripeEnabled = () => Boolean(getStripePublicKey());
