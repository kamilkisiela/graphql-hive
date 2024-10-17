import { ReactNode } from 'react';
import { getIsStripeEnabled } from '@/lib/billing/stripe-public-key';
import { Navigate } from '@tanstack/react-router';

export function RenderIfStripeAvailable(props: { children: ReactNode; organizationId: string }) {
  /**
   * If Stripe is not enabled we redirect the user to the organization.
   */
  if (!getIsStripeEnabled()) {
    return <Navigate to="/$organizationSlug" params={{ organizationSlug: props.organizationId }} />;
  }

  return <>{props.children}</>;
}
