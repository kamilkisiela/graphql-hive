import { ReactElement } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { useMutation } from 'urql';
import { Section } from '@/components/common';
import { Button, Heading, Link } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { BillingPlanType } from '@/graphql';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { CardElement } from '@stripe/react-stripe-js';

const GenerateStripeLinkMutation = graphql(`
  mutation GenerateStripeLinkMutation($selector: OrganizationSelectorInput!) {
    generateStripePortalLink(selector: $selector)
  }
`);

const BillingPaymentMethod_OrganizationFragment = graphql(`
  fragment BillingPaymentMethod_OrganizationFragment on Organization {
    id
    cleanId
    billingConfiguration {
      hasPaymentIssues
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
  const [mutation, mutate] = useMutation(GenerateStripeLinkMutation);
  const router = useRouter();

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
      <div>
        <div>
          <Section.BigTitle>Payment Method and Billing Settings</Section.BigTitle>
          <Section.Subtitle className="mb-6">
            Your current payment method is <strong>{info.brand.toUpperCase()}</strong> ending with{' '}
            {info.last4} (expires {info.expMonth}/{info.expYear}).
          </Section.Subtitle>
        </div>
        <div>
          <p className="text-sm">
          To manage or change your payment method, billing settings, billing email, Tax ID, you can
          use the Stripe customer dashboard:
          </p>
          <br />
          <Button
            variant="primary"
            onClick={() => {
              void mutate({
                selector: {
                  organization: organization.cleanId,
                },
              }).then(result => {
                if (result.data?.generateStripePortalLink) {
                  void router.push(result.data.generateStripePortalLink);
                }
              });
            }}
          >
            {mutation.fetching ? (
              'Loading...'
            ) : (
              <>
                <ExternalLinkIcon className='mr-2' /> Stripe Billing Dashboard
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
};
