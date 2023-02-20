import { ReactElement, ReactNode, Suspense, useRef } from 'react';
import { Elements as ElementsProvider } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { getStripePublicKey } from './stripe-public-key';

export const HiveStripeWrapper = ({ children }: { children: ReactNode }): ReactElement => {
  const stripeRef = useRef<ReturnType<typeof loadStripe> | null>(null);

  if (!stripeRef.current) {
    const stripePublicKey = getStripePublicKey();
    if (stripePublicKey) {
      stripeRef.current = loadStripe(stripePublicKey);
    }
  }

  const stripe = stripeRef.current;

  if (stripe === null) {
    return children as any;
  }

  return (
    <Suspense fallback={children}>
      <ElementsProvider stripe={stripe}>{children}</ElementsProvider>
    </Suspense>
  );
};
