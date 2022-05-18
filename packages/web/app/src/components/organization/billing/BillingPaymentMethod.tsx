import { Section } from '@/components/common';
import { BillingPlanType, OrgBillingInfoFieldsFragment } from '@/graphql';
import { Link } from '@chakra-ui/react';
import { CardElement } from '@stripe/react-stripe-js';
import React from 'react';
import 'twin.macro';

export const BillingPaymentMethod: React.FC<{
  plan: BillingPlanType;
  organizationBilling: OrgBillingInfoFieldsFragment;
  onValidationChange?: (isValid: boolean) => void;
}> = ({ plan, organizationBilling, onValidationChange }) => {
  if (plan === 'PRO') {
    if (!organizationBilling.billingConfiguration?.paymentMethod) {
      return (
        <>
          <Section.BigTitle>Payment Method</Section.BigTitle>
          <div tw="mb-5">
            <CardElement
              tw="mt-6 mb-6 w-3/5"
              onChange={(e) => {
                if (e.error || !e.complete) {
                  onValidationChange?.(false);
                } else {
                  onValidationChange?.(true);
                }
              }}
            />
            <Section.Subtitle>
              All payments and subscriptions are processed securely by{' '}
              <Link href="https://stripe.com/">Stripe</Link>
            </Section.Subtitle>
          </div>
        </>
      );
    } else {
      const info = organizationBilling.billingConfiguration.paymentMethod;

      return (
        <>
          <Section.BigTitle>Payment Method</Section.BigTitle>
          <Section.Subtitle tw="mb-6">
            {info.brand.toUpperCase()} ending with {info.last4} (expires{' '}
            {info.expMonth}/{info.expYear})
          </Section.Subtitle>
        </>
      );
    }
  }

  return null;
};
