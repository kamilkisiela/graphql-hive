import { Elements as ElementsProvider } from '@stripe/react-stripe-js';
import React from 'react';
import { getStripePublicKey } from './stripe-public-key';
import { loadStripe } from '@stripe/stripe-js';

export const HiveStripeWrapper: React.FC<{}> = ({ children }) => {
  const [stripe] = React.useState(() => {
    const stripePublicKey = getStripePublicKey();
    return stripePublicKey ? loadStripe(stripePublicKey) : null;
  });

  if (stripe === null) {
    return children as any;
  }
  return <ElementsProvider stripe={stripe}>{children}</ElementsProvider>;
};
