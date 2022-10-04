export const getStripePublicKey = () => {
  const stripePublicUrl = globalThis.process?.env['STRIPE_PUBLIC_KEY'] ?? globalThis['__ENV__']?.['STRIPE_PUBLIC_KEY'];
  if (!stripePublicUrl) {
    return null;
  }
  return stripePublicUrl;
};

export const getIsStripeEnabled = () => !!getStripePublicKey();
