import { Elements as ElementsProvider } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import React from 'react';

const STRIPE_PUBLIC_KEY = globalThis['__ENV__']?.['STRIPE_PUBLIC_KEY'] ?? (process.env.STRIPE_PUBLIC_KEY || null);

const stripePromise$ = !STRIPE_PUBLIC_KEY ? null : loadStripe(STRIPE_PUBLIC_KEY);

export const HiveStripeWrapper: React.FC<{}> = ({ children }) => {
  if (STRIPE_PUBLIC_KEY === null || stripePromise$ === null) {
    return children as any;
  }

  return <ElementsProvider stripe={stripePromise$}>{children}</ElementsProvider>;
};
