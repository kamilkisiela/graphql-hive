import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'urql';
import { Section } from '@/components/common';
import { QueryError } from '@/components/common/DataWrapper';
import { OrganizationLayout } from '@/components/layouts';
import { BillingPaymentMethod } from '@/components/organization/billing/BillingPaymentMethod';
import { BillingPlanPicker } from '@/components/organization/billing/BillingPlanPicker';
import { PlanSummary } from '@/components/organization/billing/PlanSummary';
import { Button, Card, DataWrapper, Heading, Input, Slider, Stat, Title } from '@/components/v2';
import { BillingPlanType } from '@/gql/graphql';
import {
  BillingPlansDocument,
  DowngradeToHobbyDocument,
  OrganizationFieldsFragment,
  OrgBillingInfoFieldsFragment,
  UpdateOrgRateLimitDocument,
  UpgradeToProDocument,
} from '@/graphql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { openChatSupport } from '@/utils';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';

function Inner({
  organization,
}: {
  organization: OrganizationFieldsFragment & OrgBillingInfoFieldsFragment;
}): ReactElement | null {
  const stripe = useStripe();
  const elements = useElements();
  const canAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: organization?.me,
    redirect: true,
  });

  const [query] = useQuery({ query: BillingPlansDocument });

  const [paymentDetailsValid, setPaymentDetailsValid] = useState(
    !!organization.billingConfiguration?.paymentMethod,
  );
  const upgradeToProMutation = useMutation(UpgradeToProDocument);
  const downgradeToHobbyMutation = useMutation(DowngradeToHobbyDocument);
  const updateOrgRateLimitMutation = useMutation(UpdateOrgRateLimitDocument);
  const planSummaryRef = useRef<HTMLDivElement>(null);

  const [plan, setPlan] = useState<BillingPlanType>(
    (organization?.plan || 'HOBBY') as BillingPlanType,
  );
  const onPlan = useCallback(
    (plan: BillingPlanType) => {
      setPlan(plan);
      const planSummaryElement = planSummaryRef.current;
      if (planSummaryElement) {
        setTimeout(() => {
          planSummaryElement.scrollIntoView({
            block: 'start',
            behavior: 'smooth',
          });
        }, 50);
      }
    },
    [setPlan, planSummaryRef],
  );
  const [couponCode, setCouponCode] = useState('');
  const [operationsRateLimit, setOperationsRateLimit] = useState(
    Math.floor((organization.rateLimit.operations || 1_000_000) / 1_000_000),
  );

  const onOperationsRateLimitChange = useCallback(
    (limit: number[]) => {
      setOperationsRateLimit(limit[0]);
    },
    [setOperationsRateLimit],
  );

  useEffect(() => {
    if (query.data?.billingPlans?.length) {
      if (organization.plan === plan) {
        setOperationsRateLimit(Math.floor((organization.rateLimit.operations || 0) / 1_000_000));
      } else {
        const actualPlan = query.data.billingPlans.find(v => v.planType === plan);

        setOperationsRateLimit(
          Math.floor((actualPlan?.includedOperationsLimit || 1_000_000) / 1_000_000),
        );
      }
    }
  }, [organization.plan, organization.rateLimit.operations, plan, query.data?.billingPlans]);

  if (!canAccess) {
    return null;
  }

  const upgrade = async () => {
    let paymentMethodId: string | null = null;

    if (organization.billingConfiguration.paymentMethod === null) {
      if (stripe === null || elements === null) {
        // TODO: what to do here?
        return;
      }
      const card = elements.getElement(CardElement);

      if (card === null) {
        // TODO: what to do here?
        return;
      }
      const { paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card,
      });

      if (paymentMethod === undefined) {
        // TODO: what to do here?
        return;
      }
      paymentMethodId = paymentMethod.id;
    }

    await upgradeToProMutation[1]({
      organization: organization.cleanId,
      monthlyLimits: {
        operations: operationsRateLimit * 1_000_000,
      },
      paymentMethodId,
      couponCode: couponCode.trim() === '' ? null : couponCode.trim(),
    });
  };

  const downgrade = async () => {
    await downgradeToHobbyMutation[1]({
      organization: organization.cleanId,
    });
  };

  const updateLimits = async () => {
    await updateOrgRateLimitMutation[1]({
      organization: organization.cleanId,
      monthlyLimits: {
        operations: operationsRateLimit * 1_000_000,
      },
    });
  };

  const renderActions = () => {
    if (plan === organization.plan) {
      if (organization.rateLimit.operations !== operationsRateLimit * 1_000_000) {
        return (
          <>
            <Button variant="primary" type="button" onClick={updateLimits}>
              Update Limits
            </Button>
            <Section.Subtitle className="mt-4">
              Updating your organization limitations might take a few minutes to update.
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
        <Button variant="primary" type="button" onClick={upgrade} disabled={!paymentDetailsValid}>
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
    <DataWrapper query={query}>
      {result => {
        // TODO: this is also not safe as billingPlans might be an empty list.
        const selectedPlan =
          result.data.billingPlans.find(v => v.planType === plan) ?? result.data.billingPlans[0];

        return (
          <div className="flex w-full flex-col gap-5">
            <Card className="w-full">
              <Heading className="mb-4">Choose Your Plan</Heading>
              <BillingPlanPicker
                activePlan={organization.plan}
                value={plan}
                plans={result.data.billingPlans}
                onPlanChange={onPlan}
              />
            </Card>
            <Card className="w-full self-start" ref={planSummaryRef}>
              <Heading className="mb-2">Plan Summary</Heading>
              <div>
                {error && <QueryError showError error={error} />}

                <div className="flex flex-col">
                  <div>
                    <PlanSummary
                      plan={selectedPlan}
                      retentionInDays={selectedPlan.retentionInDays}
                      operationsRateLimit={operationsRateLimit}
                    >
                      {selectedPlan.planType === BillingPlanType.Pro && (
                        <Stat>
                          <Stat.Label>Free Trial</Stat.Label>
                          <Stat.Number>30</Stat.Number>
                          <Stat.HelpText>days</Stat.HelpText>
                        </Stat>
                      )}
                    </PlanSummary>
                  </div>

                  {plan === BillingPlanType.Pro && (
                    <div className="my-8 w-1/2">
                      <Heading>Define your reserved volume</Heading>
                      <p className="text-sm text-gray-500">
                        Pro plan requires to defined quota of reported operations.
                      </p>
                      <p className="text-sm text-gray-500">
                        Pick a volume a little higher than you think you'll need to avoid being rate
                        limited.
                      </p>
                      <p className="text-sm text-gray-500">
                        Don't worry, you can always adjust it later.
                      </p>
                      <div className="mt-5 pl-2.5">
                        <Slider
                          min={1}
                          max={300}
                          value={[operationsRateLimit]}
                          onValueChange={onOperationsRateLimitChange}
                        />
                        <div className="flex justify-between">
                          <span>1M</span>
                          <span>100M</span>
                          <span>200M</span>
                          <span>300M</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="my-8 flex flex-row gap-6">
                    <BillingPaymentMethod
                      className="w-1/2"
                      plan={selectedPlan.planType}
                      organizationBilling={organization}
                      onValidationChange={setPaymentDetailsValid}
                    />
                    <div className="w-1/2">
                      {plan === BillingPlanType.Pro && plan !== organization.plan ? (
                        <div>
                          <Heading className="mb-3">Discount</Heading>
                          <Input
                            className="w-full"
                            size="medium"
                            value={couponCode ?? ''}
                            onChange={e => setCouponCode(e.target.value)}
                            placeholder="Code"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div>{renderActions()}</div>
                </div>
              </div>
            </Card>
          </div>
        );
      }}
    </DataWrapper>
  );
}

export default function ManageSubscriptionPage(): ReactElement {
  return (
    <>
      <Title title="Manage Subscription" />
      <OrganizationLayout includeBilling includeRateLimit>
        {({ organization }) => <Inner organization={organization} />}
      </OrganizationLayout>
    </>
  );
}
