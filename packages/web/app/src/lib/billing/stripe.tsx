import React, { PropsWithChildren } from 'react';
import { Elements as ElementsProvider } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { getStripePublicKey } from './stripe-public-key';

export const HiveStripeWrapper = ({ children }: PropsWithChildren) => {
  const [stripe] = React.useState(() => {
    const stripePublicKey = getStripePublicKey();
    return stripePublicKey ? loadStripe(stripePublicKey) : null;
  });

  if (stripe === null) {
    return children as any;
  }

  return (
    <React.Suspense fallback={children}>
      <ElementsProvider stripe={stripe}>{children}</ElementsProvider>
    </React.Suspense>
  );
};
