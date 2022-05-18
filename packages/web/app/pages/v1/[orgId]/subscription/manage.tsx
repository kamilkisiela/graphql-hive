import React, { useState } from 'react';
import 'twin.macro';
import {
  OrganizationAccessScope,
  useOrganizationAccess,
} from '@/lib/access/organization';
import { OrganizationView } from '@/components/organization/View';
import {
  BillingPlansDocument,
  DowngradeToHobbyDocument,
  OrganizationFieldsFragment,
  OrgBillingInfoFieldsFragment,
  UpdateOrgRateLimitDocument,
  UpgradeToProDocument,
} from '@/graphql';
import { Card, Page, Section } from '@/components/common';
import { useMutation, useQuery } from 'urql';
import { DataWrapper, QueryError } from '@/components/common/DataWrapper';
import { BillingPlanType } from '@/gql/graphql';
import {
  Button,
  Input,
  Stat,
  StatHelpText,
  StatLabel,
  StatNumber,
} from '@chakra-ui/react';
import { BillingPlanPicker } from '@/components/organization/billing/BillingPlanPicker';
import { PlanSummary } from '@/components/organization/billing/PlanSummary';
import { BillingPaymentMethod } from '@/components/organization/billing/BillingPaymentMethod';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';

const Inner: React.FC<{
  organization: OrganizationFieldsFragment & OrgBillingInfoFieldsFragment;
}> = ({ organization }) => {
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

  const [plan, setPlan] = React.useState<BillingPlanType>(
    (organization?.plan || 'HOBBY') as BillingPlanType
  );
  const [couponCode, setCouponCode] = React.useState<string | null>(null);
  const [operationsRateLimit, setOperationsRateLimit] = React.useState<number>(
    Math.floor(organization.rateLimit.operations / 1_000_000)
  );
  const [schemaPushesRateLimit, setSchemaPushesLimit] = React.useState<number>(
    organization.rateLimit.schemaPushes
  );

  React.useEffect(() => {
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

  const renderPaymentDetails = () => {
    if (plan === BillingPlanType.Pro && plan !== organization.plan) {
      return (
        <div tw="mb-4">
          <Input
            tw="w-2/5"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Discount Code"
          />
        </div>
      );
    }

    return null;
  };

  const renderActions = () => {
    if (plan === organization.plan) {
      if (
        organization.rateLimit.operations !== operationsRateLimit * 1_000_000 ||
        organization.rateLimit.schemaPushes !== schemaPushesRateLimit
      ) {
        return (
          <>
            <Button
              colorScheme="primary"
              type="button"
              size="sm"
              onClick={updateLimits}
            >
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
        <Button
          colorScheme="primary"
          type="button"
          size="sm"
          onClick={openChatSupport}
        >
          Contact Us
        </Button>
      );
    } else if (plan === 'PRO') {
      return (
        <Button
          colorScheme="primary"
          type="button"
          size="sm"
          onClick={upgrade}
          disabled={!paymentDetailsValid}
        >
          Upgrade to Pro
        </Button>
      );
    } else if (plan === 'HOBBY') {
      return (
        <Button
          colorScheme="primary"
          type="button"
          size="sm"
          onClick={downgrade}
        >
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
    <Page title={'Manage Subscription'}>
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
            <div tw="w-full flex flex-row">
              <div tw="flex-grow mr-12">
                <div tw="flex flex-col space-y-6 pb-6">
                  <Card.Root>
                    <Card.Title>Choose Your Plan</Card.Title>
                    <Card.Content>
                      <BillingPlanPicker
                        activePlan={organization.plan}
                        value={plan}
                        plans={result.data.billingPlans}
                        onPlanChange={setPlan}
                        operationsRateLimit={operationsRateLimit}
                        schemaPushesRateLimit={schemaPushesRateLimit}
                        onOperationsRateLimitChange={setOperationsRateLimit}
                        onSchemaPushesRateLimitChange={setSchemaPushesLimit}
                      />
                    </Card.Content>
                  </Card.Root>
                </div>
              </div>
              <div tw="flex-grow-0 w-5/12">
                <Card.Root>
                  <Card.Title>Plan Summary</Card.Title>
                  <Card.Content>
                    {error ? (
                      <QueryError showError={true} error={error} />
                    ) : null}
                    <PlanSummary
                      plan={selectedPlan}
                      operationsRateLimit={operationsRateLimit}
                      schemaPushesRateLimit={schemaPushesRateLimit}
                    >
                      {selectedPlan.planType === BillingPlanType.Pro ? (
                        <Stat tw="mb-4">
                          <StatLabel>Free Trial</StatLabel>
                          <StatNumber>14</StatNumber>
                          <StatHelpText>days</StatHelpText>
                        </Stat>
                      ) : null}
                    </PlanSummary>
                    <BillingPaymentMethod
                      plan={selectedPlan.planType}
                      organizationBilling={organization}
                      onValidationChange={(v) => setPaymentDetailsValid(v)}
                    />
                    {renderPaymentDetails()}
                    {renderActions()}
                  </Card.Content>
                </Card.Root>
              </div>
            </div>
          );
        }}
      </DataWrapper>
    </Page>
  );
};

export default function ManageSubscriptionPage() {
  return (
    <OrganizationView title="Manage Subscription" includeBilling={true}>
      {({ organization }) => <Inner organization={organization} />}
    </OrganizationView>
  );
}
