import { Section } from '@/components/common';
import { BillingPlanType, OrgBillingInfoFieldsFragment } from '@/graphql';
import { Link } from '@/components/v2';
import { CardElement } from '@stripe/react-stripe-js';
import { ReactElement } from 'react';

export const BillingPaymentMethod = ({
  plan,
  organizationBilling,
  onValidationChange,
}: {
  plan: BillingPlanType;
  organizationBilling: OrgBillingInfoFieldsFragment;
  onValidationChange?: (isValid: boolean) => void;
}): ReactElement => {
  if (plan !== 'PRO') {
    return null;
  }

  if (!organizationBilling.billingConfiguration?.paymentMethod) {
    return (
      <div className="my-5 flex flex-col gap-6 rounded-md bg-gray-500/5 p-5">
        <Section.BigTitle>Payment Method</Section.BigTitle>
        <CardElement
          onChange={(e) => {
            if (e.error || !e.complete) {
              onValidationChange?.(false);
            } else {
              onValidationChange?.(true);
            }
          }}
          options={{
            style: {
              base: {
                color: '#fff',
              },
            },
          }}
        />
        <Section.Subtitle>
          All payments and subscriptions are processed securely by{' '}
          <Link
            variant="primary"
            href="https://stripe.com"
            target="_blank"
            rel="noreferrer"
          >
            Stripe
          </Link>
        </Section.Subtitle>
      </div>
    );
  }
  const info = organizationBilling.billingConfiguration.paymentMethod;

  return (
    <>
      <Section.BigTitle>Payment Method</Section.BigTitle>
      <Section.Subtitle className="mb-6">
        {info.brand.toUpperCase()} ending with {info.last4} (expires{' '}
        {info.expMonth}/{info.expYear})
      </Section.Subtitle>
    </>
  );
};
