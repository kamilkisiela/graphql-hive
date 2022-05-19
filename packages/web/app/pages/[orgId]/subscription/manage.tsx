import { ReactElement, useEffect, useState } from 'react';
import 'twin.macro';
import { Stat, StatHelpText, StatLabel, StatNumber } from '@chakra-ui/react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useMutation, useQuery } from 'urql';

import { Card, Section } from '@/components/common';
import { DataWrapper, QueryError } from '@/components/common/DataWrapper';
import { BillingPaymentMethod } from '@/components/organization/billing/BillingPaymentMethod';
import { BillingPlanPicker } from '@/components/organization/billing/BillingPlanPicker';
import { LimitSlider } from '@/components/organization/billing/LimitSlider';
import { PlanSummary } from '@/components/organization/billing/PlanSummary';
import { OrganizationView } from '@/components/organization/View';
import { Button, Input } from '@/components/v2';
import { BillingPlanType } from '@/gql/graphql';
import {
  BillingPlansDocument,
  DowngradeToHobbyDocument,
  OrganizationFieldsFragment,
  OrgBillingInfoFieldsFragment,
  UpdateOrgRateLimitDocument,
  UpgradeToProDocument,
} from '@/graphql';
import {
  OrganizationAccessScope,
  useOrganizationAccess,
} from '@/lib/access/organization';

const Inner = ({
  organization,
}: {
  organization: OrganizationFieldsFragment & OrgBillingInfoFieldsFragment;
}): ReactElement => {
  const stripe = useStripe();
  const elements = useElements();
  const canAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: organization?.me,
    redirect: true,
  });

  const [query] = useQuery({
    query: BillingPlansDocument,
  });

  const [paymentDetailsValid, setPaymentDetailsValid] = useState(
    !!organization.billingConfiguration?.paymentMethod
  );
  const upgradeToProMutation = useMutation(UpgradeToProDocument);
  const downgradeToHobbyMutation = useMutation(DowngradeToHobbyDocument);
  const updateOrgRateLimitMutation = useMutation(UpdateOrgRateLimitDocument);

  const [plan, setPlan] = useState<BillingPlanType>(
    (organization?.plan || 'HOBBY') as BillingPlanType
  );
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [operationsRateLimit, setOperationsRateLimit] = useState<number>(
    Math.floor(organization.rateLimit.operations / 1_000_000)
  );
  const [schemaPushesRateLimit, setSchemaPushesLimit] = useState<number>(
    organization.rateLimit.schemaPushes
  );

  useEffect(() => {
    if (query.data?.billingPlans?.length > 0) {
      if (organization.plan !== plan) {
        const actualPlan = query.data.billingPlans.find(
          (v) => v.planType === plan
        );

        setOperationsRateLimit(
          Math.floor(actualPlan.includedOperationsLimit / 1_000_000)
        );
        setSchemaPushesLimit(actualPlan.includedSchemaPushLimit);
      } else {
        setOperationsRateLimit(
          Math.floor(organization.rateLimit.operations / 1_000_000)
        );
        setSchemaPushesLimit(organization.rateLimit.schemaPushes);
      }
    }
  }, [plan, query.data?.billingPlans?.length]);

  if (!canAccess) {
    return null;
  }

  const openChatSupport = () => {
    if (typeof window !== 'undefined' && (window as any).$crisp) {
      (window as any).$crisp.push(['do', 'chat:open']);
    }
  };

  const upgrade = async () => {
    let paymentMethodId: string | null = null;

    if (organization.billingConfiguration.paymentMethod === null) {
      const { paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement),
      });
      paymentMethodId = paymentMethod.id;
    }

    upgradeToProMutation[1]({
      organization: organization.cleanId,
      monthlyLimits: {
        operations: operationsRateLimit * 1_000_000,
        schemaPushes: schemaPushesRateLimit,
      },
      paymentMethodId: paymentMethodId,
      couponCode,
    });
  };

  const downgrade = () => {
    downgradeToHobbyMutation[1]({
      organization: organization.cleanId,
    });
  };

  const updateLimits = () => {
    updateOrgRateLimitMutation[1]({
      organization: organization.cleanId,
      monthlyLimits: {
        operations: operationsRateLimit * 1_000_000,
        schemaPushes: schemaPushesRateLimit,
      },
    });
  };

  const renderActions = () => {
    if (plan === organization.plan) {
      if (
        organization.rateLimit.operations !== operationsRateLimit * 1_000_000 ||
        organization.rateLimit.schemaPushes !== schemaPushesRateLimit
      ) {
        return (
          <>
            <Button variant="primary" type="button" onClick={updateLimits}>
              Update Limits
            </Button>
            <Section.Subtitle tw="mt-4">
              Updating your organization limitations might take a few minutes to
              update.
            </Section.Subtitle>
          </>
        );
      }

      return null;
    }

    if (plan === 'ENTERPRISE') {
      return (
        <Button variant="primary" type="button" onClick={openChatSupport}>
          Contact Us
        </Button>
      );
    }
    if (plan === 'PRO') {
      return (
        <Button
          variant="primary"
          type="button"
          onClick={upgrade}
          disabled={!paymentDetailsValid}
        >
          Upgrade to Pro
        </Button>
      );
    }
    if (plan === 'HOBBY') {
      return (
        <Button variant="primary" type="button" onClick={downgrade}>
          Downgrade to Hobby
        </Button>
      );
    }

    return null;
  };

  const error =
    upgradeToProMutation[0].error ||
    downgradeToHobbyMutation[0].error ||
    updateOrgRateLimitMutation[0].error;

  return (
    <DataWrapper
      query={query}
      loading={
        upgradeToProMutation[0].fetching ||
        downgradeToHobbyMutation[0].fetching ||
        updateOrgRateLimitMutation[0].fetching
      }
    >
      {(result) => {
        const selectedPlan = result.data.billingPlans.find(
          (v) => v.planType === plan
        );

        return (
          <div className="flex w-full flex-row gap-5">
            <Card.Root className="w-1/2">
              <Card.Title>Choose Your Plan</Card.Title>
              <Card.Content>
                <BillingPlanPicker
                  activePlan={organization.plan}
                  value={plan}
                  plans={result.data.billingPlans}
                  onPlanChange={setPlan}
                />
              </Card.Content>
            </Card.Root>
            <Card.Root className="w-1/2 self-start">
              <Card.Title>Plan Summary</Card.Title>
              <Card.Content>
                {error && <QueryError showError error={error} />}

                <PlanSummary
                  plan={selectedPlan}
                  operationsRateLimit={operationsRateLimit}
                  schemaPushesRateLimit={schemaPushesRateLimit}
                >
                  {selectedPlan.planType === BillingPlanType.Pro && (
                    <Stat tw="mb-4">
                      <StatLabel>Free Trial</StatLabel>
                      <StatNumber>14</StatNumber>
                      <StatHelpText>days</StatHelpText>
                    </Stat>
                  )}
                </PlanSummary>

                {plan === BillingPlanType.Pro && (
                  <div className="flex flex-col gap-7 rounded-md bg-gray-500/5 p-5 pb-10">
                    <Section.Title>
                      Customize your reserved volume
                    </Section.Title>
                    <LimitSlider
                      title="Monthly GraphQL operations limit"
                      min={5}
                      max={200}
                      step={1}
                      marks={[
                        { value: 5, label: '5M (included)' },
                        { value: 50, label: '50M' },
                        { value: 100, label: '100M' },
                        { value: 200, label: '200M' },
                      ]}
                      value={operationsRateLimit}
                      onChange={setOperationsRateLimit}
                    />
                    <LimitSlider
                      title="Monthly GraphQL schema pushes"
                      min={500}
                      max={1000}
                      step={10}
                      marks={[
                        { value: 500, label: '500 (included)' },
                        { value: 1000, label: '1000' },
                      ]}
                      value={schemaPushesRateLimit}
                      onChange={setSchemaPushesLimit}
                    />
                  </div>
                )}

                <BillingPaymentMethod
                  plan={selectedPlan.planType}
                  organizationBilling={organization}
                  onValidationChange={setPaymentDetailsValid}
                />

                {plan === BillingPlanType.Pro && plan !== organization.plan && (
                  <Input
                    className="mb-5"
                    size="medium"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Discount Code"
                  />
                )}

                {renderActions()}
              </Card.Content>
            </Card.Root>
          </div>
        );
      }}
    </DataWrapper>
  );
};

export default function ManageSubscriptionPage(): ReactElement {
  return (
    <OrganizationView title="Manage Subscription" includeBilling>
      {({ organization }) => <Inner organization={organization} />}
    </OrganizationView>
  );
}
