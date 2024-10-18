import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'urql';
import { OrganizationLayout, Page } from '@/components/layouts/organization';
import {
  BillingPaymentMethodForm,
  ManagePaymentMethod,
} from '@/components/organization/billing/BillingPaymentMethod';
import { BillingPlanPicker } from '@/components/organization/billing/BillingPlanPicker';
import { PlanSummary } from '@/components/organization/billing/PlanSummary';
import { RenderIfStripeAvailable } from '@/components/organization/stripe';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { Card } from '@/components/v2/card';
import { Input } from '@/components/v2/input';
import { Slider } from '@/components/v2/slider';
import Stat from '@/components/v2/stat';
import { FragmentType, graphql, useFragment } from '@/gql';
import { BillingPlanType } from '@/gql/graphql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { Link } from '@tanstack/react-router';

const ManageSubscriptionInner_OrganizationFragment = graphql(`
  fragment ManageSubscriptionInner_OrganizationFragment on Organization {
    slug
    me {
      ...CanAccessOrganization_MemberFragment
    }
    billingConfiguration {
      hasPaymentIssues
      canUpdateSubscription
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
  mutation ManageSubscription_DowngradeToHobby($organizationSlug: String!) {
    downgradeToHobby(input: { organization: { organizationSlug: $organizationSlug } }) {
      previousPlan
      newPlan
      organization {
        ...ManageSubscriptionInner_OrganizationFragment
      }
    }
  }
`);

const BillingUpgradeToProMutation = graphql(`
  mutation ManageSubscription_UpgradeToPro(
    $organizationSlug: String!
    $paymentMethodId: String
    $couponCode: String
    $monthlyLimits: RateLimitInput!
  ) {
    upgradeToPro(
      input: {
        paymentMethodId: $paymentMethodId
        couponCode: $couponCode
        organization: { organizationSlug: $organizationSlug }
        monthlyLimits: $monthlyLimits
      }
    ) {
      previousPlan
      newPlan
      organization {
        ...ManageSubscriptionInner_OrganizationFragment
      }
    }
  }
`);

const UpdateOrgRateLimitMutation = graphql(`
  mutation updateOrgRateLimit($organizationSlug: String!, $monthlyLimits: RateLimitInput!) {
    updateOrgRateLimit(
      monthlyLimits: $monthlyLimits
      selector: { organizationSlug: $organizationSlug }
    ) {
      ...ManageSubscriptionInner_OrganizationFragment
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
    organizationSlug: organization.slug,
  });

  const [query] = useQuery({ query: BillingsPlanQuery });

  const [paymentDetailsValid, setPaymentDetailsValid] = useState(
    !!organization.billingConfiguration?.paymentMethod,
  );
  const [upgradeToProMutationState, upgradeToProMutation] = useMutation(
    BillingUpgradeToProMutation,
  );
  const [downgradeToHobbyMutationState, downgradeToHobbyMutation] =
    useMutation(BillingDowngradeMutation);
  const [updateOrgRateLimitMutationState, updateOrgRateLimitMutation] = useMutation(
    UpdateOrgRateLimitMutation,
  );
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

  const isFetching =
    updateOrgRateLimitMutationState.fetching ||
    downgradeToHobbyMutationState.fetching ||
    upgradeToProMutationState.fetching;

  const billingPlans = useFragment(
    ManageSubscriptionInner_BillingPlansFragment,
    props.billingPlans,
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

  const upgrade = useCallback(async () => {
    if (isFetching) {
      return;
    }

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

    await upgradeToProMutation({
      organizationSlug: organization.slug,
      monthlyLimits: {
        operations: operationsRateLimit * 1_000_000,
      },
      paymentMethodId,
      couponCode: couponCode.trim() === '' ? null : couponCode.trim(),
    });
  }, [
    organization,
    stripe,
    elements,
    upgradeToProMutation,
    isFetching,
    operationsRateLimit,
    couponCode,
  ]);

  const downgrade = useCallback(async () => {
    if (isFetching) {
      return;
    }

    await downgradeToHobbyMutation({
      organizationSlug: organization.slug,
    });
  }, [organization.slug, downgradeToHobbyMutation, isFetching]);

  const updateLimits = useCallback(async () => {
    if (isFetching) {
      return;
    }

    await updateOrgRateLimitMutation({
      organizationSlug: organization.slug,
      monthlyLimits: {
        operations: operationsRateLimit * 1_000_000,
      },
    });
  }, [organization.slug, operationsRateLimit, updateOrgRateLimitMutation, isFetching]);

  if (!canAccess) {
    return null;
  }

  const renderActions = () => {
    if (plan === organization.plan) {
      return null;
    }

    if (plan === 'ENTERPRISE') {
      return (
        <Button type="button" asChild className="mt-2">
          <a href="mailto:contact@graphql-hive.com">Contact Us</a>
        </Button>
      );
    }

    if (plan === 'PRO') {
      return (
        <>
          <div className="my-8 flex flex-row gap-6">
            <BillingPaymentMethodForm
              className="w-1/2"
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
                    disabled={isFetching}
                    onChange={e => setCouponCode(e.target.value)}
                    placeholder="Code"
                  />
                </div>
              ) : null}
            </div>
          </div>
          <Button type="button" onClick={upgrade} disabled={!paymentDetailsValid || isFetching}>
            Upgrade to Pro
          </Button>
        </>
      );
    }

    if (plan === 'HOBBY') {
      return (
        <Button type="button" onClick={downgrade} disabled={isFetching}>
          Downgrade to Hobby
        </Button>
      );
    }

    return null;
  };

  const error =
    upgradeToProMutationState.error ||
    downgradeToHobbyMutationState.error ||
    updateOrgRateLimitMutationState.error;

  // TODO: this is also not safe as billingPlans might be an empty list.
  const selectedPlan = billingPlans.find(v => v.planType === plan) ?? billingPlans[0];

  return (
    <div className="flex w-full flex-col gap-5">
      <Card className="w-full">
        <Heading className="mb-4">Choose Your Plan</Heading>
        <BillingPlanPicker
          disabled={
            organization.plan === BillingPlanType.Enterprise ||
            !organization.billingConfiguration.canUpdateSubscription
          }
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

            {plan === BillingPlanType.Pro &&
              organization.billingConfiguration.canUpdateSubscription && (
                <>
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
                        disabled={isFetching}
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
                  {plan === organization.plan ? (
                    <div>
                      <Button
                        type="button"
                        onClick={updateLimits}
                        disabled={
                          isFetching ||
                          organization.rateLimit.operations === operationsRateLimit * 1_000_000
                        }
                      >
                        Update Limits
                      </Button>
                      <ManagePaymentMethod organization={organization} plan={plan} />
                    </div>
                  ) : null}
                </>
              )}

            {error && <QueryError organizationSlug={organization.slug} showError error={error} />}
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
        slug
        ...ManageSubscriptionInner_OrganizationFragment
      }
    }
    billingPlans {
      ...ManageSubscriptionInner_BillingPlansFragment
    }
  }
`);

function ManageSubscriptionPageContent(props: { organizationSlug: string }) {
  const [query] = useQuery({
    query: ManageSubscriptionPageQuery,
    variables: {
      selector: {
        organizationSlug: props.organizationSlug,
      },
    },
  });

  const currentOrganization = query.data?.organization?.organization;
  const billingPlans = query.data?.billingPlans;

  const organization = useFragment(
    ManageSubscriptionInner_OrganizationFragment,
    currentOrganization,
  );
  useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: organization?.me ?? null,
    redirect: true,
    organizationSlug: props.organizationSlug,
  });

  if (query.error) {
    return <QueryError organizationSlug={props.organizationSlug} error={query.error} />;
  }

  return (
    <OrganizationLayout
      page={Page.Subscription}
      organizationSlug={props.organizationSlug}
      className="flex flex-col gap-y-10"
    >
      <div className="grow">
        <div className="flex flex-row items-center justify-between py-6">
          <div>
            <Title>Manage subscription</Title>
            <Subtitle>Manage your current plan and invoices.</Subtitle>
          </div>
          {currentOrganization ? (
            <div>
              <Button asChild>
                <Link
                  to="/$organizationSlug/view/subscription"
                  params={{ organizationSlug: currentOrganization.slug }}
                >
                  Subscription usage
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
        <div>
          {currentOrganization && billingPlans ? (
            <Inner organization={currentOrganization} billingPlans={billingPlans} />
          ) : null}
        </div>
      </div>
    </OrganizationLayout>
  );
}

export function OrganizationSubscriptionManagePage(props: {
  organizationSlug: string;
}): ReactElement {
  return (
    <>
      <Meta title="Manage Subscription" />
      <RenderIfStripeAvailable organizationSlug={props.organizationSlug}>
        <ManageSubscriptionPageContent organizationSlug={props.organizationSlug} />
      </RenderIfStripeAvailable>
    </>
  );
}
