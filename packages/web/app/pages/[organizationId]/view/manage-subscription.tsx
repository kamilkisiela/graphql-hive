import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import { useMutation, useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Section } from '@/components/common';
import { OrganizationLayout } from '@/components/layouts/organization';
import { BillingPaymentMethod } from '@/components/organization/billing/BillingPaymentMethod';
import { BillingPlanPicker } from '@/components/organization/billing/BillingPlanPicker';
import { PlanSummary } from '@/components/organization/billing/PlanSummary';
import { Button } from '@/components/ui/button';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { Card, Heading, Input, MetaTitle, Slider, Stat } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { BillingPlanType } from '@/gql/graphql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { getIsStripeEnabled } from '@/lib/billing/stripe-public-key';
import { useRouteSelector } from '@/lib/hooks';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';

const ManageSubscriptionInner_OrganizationFragment = graphql(`
  fragment ManageSubscriptionInner_OrganizationFragment on Organization {
    cleanId
    me {
      ...CanAccessOrganization_MemberFragment
    }
    billingConfiguration {
      hasPaymentIssues
      paymentMethod {
        __typename
      }
    }
    plan
    rateLimit {
      operations
    }
    ...BillingPaymentMethod_OrganizationFragment
  }
`);

const ManageSubscriptionInner_BillingPlansFragment = graphql(`
  fragment ManageSubscriptionInner_BillingPlansFragment on BillingPlan {
    ...BillingPlanPicker_PlanFragment
    planType
    retentionInDays
    ...PlanSummary_PlanFragment
  }
`);

const BillingsPlanQuery = graphql(`
  query ManageSubscription_BillingPlans {
    billingPlans {
      id
      planType
      name
      basePrice
      description
      includedOperationsLimit
      pricePerOperationsUnit
      rateLimit
      retentionInDays
    }
  }
`);

const BillingDowngradeMutation = graphql(`
  mutation ManageSubscription_DowngradeToHobby($organization: ID!) {
    downgradeToHobby(input: { organization: { organization: $organization } }) {
      previousPlan
      newPlan
      organization {
        ...OrgBillingInfoFields
      }
    }
  }
`);

const BillingUpgradeToProMutation = graphql(`
  mutation ManageSubscription_UpgradeToPro(
    $organization: ID!
    $paymentMethodId: String
    $couponCode: String
    $monthlyLimits: RateLimitInput!
  ) {
    upgradeToPro(
      input: {
        paymentMethodId: $paymentMethodId
        couponCode: $couponCode
        organization: { organization: $organization }
        monthlyLimits: $monthlyLimits
      }
    ) {
      previousPlan
      newPlan
      organization {
        ...OrgBillingInfoFields
      }
    }
  }
`);

const UpdateOrgRateLimitMutation = graphql(`
  mutation updateOrgRateLimit($organization: ID!, $monthlyLimits: RateLimitInput!) {
    updateOrgRateLimit(monthlyLimits: $monthlyLimits, selector: { organization: $organization }) {
      ...OrgBillingInfoFields
    }
  }
`);

function Inner(props: {
  organization: FragmentType<typeof ManageSubscriptionInner_OrganizationFragment>;
  billingPlans: Array<FragmentType<typeof ManageSubscriptionInner_BillingPlansFragment>>;
}): ReactElement | null {
  const organization = useFragment(
    ManageSubscriptionInner_OrganizationFragment,
    props.organization,
  );
  const stripe = useStripe();
  const elements = useElements();
  const canAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: organization?.me,
    redirect: true,
  });

  const [query] = useQuery({ query: BillingsPlanQuery });

  const [paymentDetailsValid, setPaymentDetailsValid] = useState(
    !!organization.billingConfiguration?.paymentMethod,
  );
  const upgradeToProMutation = useMutation(BillingUpgradeToProMutation);
  const downgradeToHobbyMutation = useMutation(BillingDowngradeMutation);
  const updateOrgRateLimitMutation = useMutation(UpdateOrgRateLimitMutation);
  const planSummaryRef = useRef<HTMLDivElement>(null);

  const [plan, setPlan] = useState<BillingPlanType>(organization?.plan || 'HOBBY');
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
            <Button type="button" onClick={updateLimits}>
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
        <Button type="button" asChild>
          <a href="emailto:contact@graphql-hive.com">Contact Us</a>
        </Button>
      );
    }

    if (plan === 'PRO') {
      return (
        <Button type="button" onClick={upgrade} disabled={!paymentDetailsValid}>
          Upgrade to Pro
        </Button>
      );
    }

    if (plan === 'HOBBY') {
      return (
        <Button type="button" onClick={downgrade}>
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

  const billingPlans = useFragment(
    ManageSubscriptionInner_BillingPlansFragment,
    props.billingPlans,
  );

  // TODO: this is also not safe as billingPlans might be an empty list.
  const selectedPlan = billingPlans.find(v => v.planType === plan) ?? billingPlans[0];

  return (
    <div className="flex w-full flex-col gap-5">
      <Card className="w-full">
        <Heading className="mb-4">Choose Your Plan</Heading>
        <BillingPlanPicker
          disabled={organization.plan === BillingPlanType.Enterprise}
          activePlan={organization.plan}
          value={plan}
          plans={billingPlans}
          onPlanChange={onPlan}
        />
      </Card>
      <Card className="w-full self-start" ref={planSummaryRef}>
        <Heading className="mb-2">Plan Summary</Heading>
        <div>
          <div className="flex flex-col">
            <div>
              <PlanSummary plan={selectedPlan} operationsRateLimit={operationsRateLimit}>
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
                organization={organization}
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
            {error && <QueryError showError error={error} />}
            <div>{renderActions()}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

const ManageSubscriptionPageQuery = graphql(`
  query ManageSubscriptionPageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        cleanId
        ...OrganizationLayout_CurrentOrganizationFragment
        ...ManageSubscriptionInner_OrganizationFragment
      }
    }
    billingPlans {
      ...ManageSubscriptionInner_BillingPlansFragment
    }
    organizations {
      ...OrganizationLayout_OrganizationConnectionFragment
    }
    me {
      ...OrganizationLayout_MeFragment
    }
  }
`);

function ManageSubscriptionPageContent() {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: ManageSubscriptionPageQuery,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const organizationConnection = query.data?.organizations;
  const billingPlans = query.data?.billingPlans;

  const organization = useFragment(
    ManageSubscriptionInner_OrganizationFragment,
    currentOrganization,
  );
  const canAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: organization?.me ?? null,
    redirect: true,
  });

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  if (!currentOrganization || !me || !organizationConnection || !organization || !billingPlans) {
    return null;
  }

  if (!canAccess) {
    return null;
  }

  return (
    <OrganizationLayout
      value="subscription"
      className="flex flex-col gap-y-10"
      currentOrganization={currentOrganization}
      organizations={organizationConnection}
      me={me}
    >
      <div className="grow">
        <div className="py-6 flex flex-row justify-between items-center">
          <div>
            <Title>Manage subscription</Title>
            <Subtitle>Manage your current plan and invoices.</Subtitle>
          </div>
          <div>
            <Button asChild>
              <NextLink
                href={{
                  pathname: '/organizations/[organizationId]/view/subscription',
                  query: {
                    organizationId: currentOrganization.cleanId,
                  },
                }}
              >
                Subscription usage
              </NextLink>
            </Button>
          </div>
        </div>
        <div>
          <Inner organization={currentOrganization} billingPlans={billingPlans} />
        </div>
      </div>
    </OrganizationLayout>
  );
}

function ManageSubscriptionPage(): ReactElement {
  return (
    <>
      <MetaTitle title="Manage Subscription" />
      <ManageSubscriptionPageContent />
    </>
  );
}

export const getServerSideProps = withSessionProtection(async context => {
  /**
   * If Stripe is not enabled we redirect the user to the organization.
   */
  const isStripeEnabled = getIsStripeEnabled();
  if (!isStripeEnabled) {
    const parts = String(context.resolvedUrl).split('/');
    parts.pop();
    return {
      redirect: {
        destination: parts.join('/'),
        permanent: false,
      },
    };
  }
  return { props: {} };
});

export default authenticated(ManageSubscriptionPage);
