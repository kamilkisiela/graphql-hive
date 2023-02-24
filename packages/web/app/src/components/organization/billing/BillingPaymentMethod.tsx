import { ReactElement } from 'react';
import clsx from 'clsx';
import { Section } from '@/components/common';
import { Heading, Link } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { BillingPlanType } from '@/graphql';
import { CardElement } from '@stripe/react-stripe-js';

const BillingPaymentMethod_OrganizationFragment = graphql(`
  fragment BillingPaymentMethod_OrganizationFragment on Organization {
    billingConfiguration {
      paymentMethod {
        brand
        last4
        expMonth
        expYear
      }
    }
  }
`);

export const BillingPaymentMethod = ({
  plan,
  onValidationChange,
  className,
  ...props
}: {
  plan: BillingPlanType;
  className?: string;
  organization: FragmentType<typeof BillingPaymentMethod_OrganizationFragment>;
  onValidationChange?: (isValid: boolean) => void;
}): ReactElement | null => {
  if (plan !== 'PRO') {
    return null;
  }

  const organization = useFragment(BillingPaymentMethod_OrganizationFragment, props.organization);

  if (!organization.billingConfiguration?.paymentMethod) {
    return (
      <div className={clsx('flex flex-col gap-6', className)}>
        <Heading>Payment Method</Heading>
        <CardElement
          className="grow"
          onChange={e => {
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
          <Link variant="primary" href="https://stripe.com" target="_blank" rel="noreferrer">
            Stripe
          </Link>
        </Section.Subtitle>
      </div>
    );
  }
  const info = organization.billingConfiguration.paymentMethod;

  return (
    <>
      <Section.BigTitle>Payment Method</Section.BigTitle>
      <Section.Subtitle className="mb-6">
        {info.brand.toUpperCase()} ending with {info.last4} (expires {info.expMonth}/{info.expYear})
      </Section.Subtitle>
    </>
  );
};
