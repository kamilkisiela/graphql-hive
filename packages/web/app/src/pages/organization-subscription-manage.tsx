import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'urql';
import { OrganizationLayout, Page } from '@/components/layouts/organization';
import { BillingPlanPicker } from '@/components/organization/billing/BillingPlanPicker';
import { BillingSettings } from '@/components/organization/billing/BillingSettings';
import {
  PaddleCheckout_OrgInfo,
  PaddleCheckout_UserInfo,
  PaddleCheckoutForm,
} from '@/components/organization/billing/PaddleCheckout';
import { PlanSummary } from '@/components/organization/billing/PlanSummary';
import { RenderIfStripeAvailable } from '@/components/organization/stripe';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { Card, Link, Slider, Stat } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { BillingPlanType } from '@/gql/graphql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { getPaddleClientConfig } from '@/lib/billing/paddle-public-key';
import { useRouter } from '@tanstack/react-router';

const ManageSubscriptionInner_OrganizationFragment = graphql(`
  fragment ManageSubscriptionInner_OrganizationFragment on Organization {
    cleanId
    me {
      ...CanAccessOrganization_MemberFragment
    }
    billingConfiguration {
      provider
      hasPaymentIssues
      canUpdateSubscription
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
    id
    planType
    retentionInDays
    ...BillingPlanPicker_PlanFragment
    ...PaddleCheckout_BillingPlansDetails
    ...PlanSummary_PlanFragment
  }
`);

const BillingsPlanQuery = graphql(`
  query ManageSubscription_BillingPlans {
    billingPlans {
      id
      planType
      name
      basePrice {
        id
        amount
      }
      description
      includedOperationsLimit
      pricePerOperationsUnit {
        id
        amount
      }
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
        ...ManageSubscriptionInner_OrganizationFragment
      }
    }
  }
`);

const UpdateOrgRateLimitMutation = graphql(`
  mutation updateOrgRateLimit($organization: ID!, $monthlyLimits: RateLimitInput!) {
    updateOrgRateLimit(monthlyLimits: $monthlyLimits, selector: { organization: $organization }) {
      ...ManageSubscriptionInner_OrganizationFragment
    }
  }
`);

function Inner(props: {
  orgInfo: FragmentType<typeof PaddleCheckout_OrgInfo>;
  me: FragmentType<typeof PaddleCheckout_UserInfo>;
  organization: FragmentType<typeof ManageSubscriptionInner_OrganizationFragment>;
  billingPlans: Array<FragmentType<typeof ManageSubscriptionInner_BillingPlansFragment>>;
}): ReactElement | null {
  const organization = useFragment(
    ManageSubscriptionInner_OrganizationFragment,
    props.organization,
  );
  const canAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: organization?.me,
    redirect: true,
    organizationId: organization.cleanId,
  });

  const [query] = useQuery({ query: BillingsPlanQuery });

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
    updateOrgRateLimitMutationState.fetching || downgradeToHobbyMutationState.fetching;

  const billingPlans = useFragment(
    ManageSubscriptionInner_BillingPlansFragment,
    props.billingPlans,
  );
  const proPlan = billingPlans.find(v => v.planType === BillingPlanType.Pro)!;

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

  const downgrade = useCallback(async () => {
    if (isFetching) {
      return;
    }

    await downgradeToHobbyMutation({
      organization: organization.cleanId,
    });
  }, [organization.cleanId, downgradeToHobbyMutation, isFetching]);

  const updateLimits = useCallback(async () => {
    if (isFetching) {
      return;
    }

    await updateOrgRateLimitMutation({
      organization: organization.cleanId,
      monthlyLimits: {
        operations: operationsRateLimit * 1_000_000,
      },
    });
  }, [organization.cleanId, operationsRateLimit, updateOrgRateLimitMutation, isFetching]);

  if (!canAccess) {
    return null;
  }

  const error = downgradeToHobbyMutationState.error || updateOrgRateLimitMutationState.error;

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
            {error && <QueryError organizationId={organization.id} showError error={error} />}
          </div>
        </div>
        {plan === 'HOBBY' && organization.plan !== plan ? (
          <ButtonV2 type="button" variant="primary" onClick={downgrade} disabled={isFetching}>
            Downgrade to Hobby
          </ButtonV2>
        ) : null}
      </Card>

      {plan === BillingPlanType.Pro && organization.billingConfiguration.canUpdateSubscription && (
        <Card>
          <Heading className="mb-2">Reserved Volume</Heading>
          <div className="w-1/2">
            <p className="text-sm text-gray-500">
              Your plan requires a defined quota of reported GraphQL operations.
            </p>
            <p className="text-sm text-gray-500">
              Pick a volume a little higher than you think you'll need to avoid being rate limited.
              You can change your volume at any time.
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
            <div className="py-4 text-sm text-gray-500">
              Need more than 300M operations/month?{' '}
              <Link variant="primary" href={`/${organization.cleanId}/view/support`}>
                contact our support team for a dedicated price quote
              </Link>
              .
            </div>
            {plan === organization.plan ? (
              <div>
                <ButtonV2
                  type="button"
                  variant="primary"
                  onClick={updateLimits}
                  disabled={
                    isFetching ||
                    organization.rateLimit.operations === operationsRateLimit * 1_000_000
                  }
                >
                  Update Subscription
                </ButtonV2>
              </div>
            ) : null}
          </div>
        </Card>
      )}
      {plan === 'PRO' && organization.plan !== plan ? (
        <Card>
          <Heading>Payment Method</Heading>
          <PaddleCheckoutForm
            orgInfo={props.orgInfo}
            me={props.me}
            operationsInMillions={operationsRateLimit}
            planPrices={proPlan}
          />
        </Card>
      ) : null}
      {plan === organization.plan &&
      organization.plan === 'PRO' &&
      organization.billingConfiguration.canUpdateSubscription ? (
        <Card>
          <Heading className="mb-2">Billing Settings</Heading>
          <BillingSettings organization={organization} />
        </Card>
      ) : null}
    </div>
  );
}

const ManageSubscriptionPageQuery = graphql(`
  query ManageSubscriptionPageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        id
        cleanId
        ...ManageSubscriptionInner_OrganizationFragment
        ...PaddleCheckout_OrgInfo
      }
    }
    billingPlans {
      ...ManageSubscriptionInner_BillingPlansFragment
    }
    me {
      ...PaddleCheckout_UserInfo
    }
  }
`);

function ManageSubscriptionPageContent(props: { organizationId: string }) {
  const router = useRouter();

  /**
   * If Paddle is not enabled we redirect the user to the organization.
   */
  if (!getPaddleClientConfig()) {
    void router.navigate({
      to: '/$organizationId',
      params: {
        organizationId: props.organizationId,
      },
    });
    return null;
  }

  const [query] = useQuery({
    query: ManageSubscriptionPageQuery,
    variables: {
      selector: {
        organization: props.organizationId,
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
    organizationId: props.organizationId,
  });

  if (query.error) {
    return <QueryError organizationId={props.organizationId} error={query.error} />;
  }

  return (
    <OrganizationLayout
      page={Page.Subscription}
      organizationId={props.organizationId}
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
                  to="/$organizationId/view/subscription"
                  params={{ organizationId: currentOrganization.cleanId }}
                >
                  Subscription usage
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
        <div>
          <Inner
            organization={currentOrganization}
            billingPlans={billingPlans}
            me={me}
            orgInfo={currentOrganization}
          />
        </div>
      </div>
    </OrganizationLayout>
  );
}

export function OrganizationSubscriptionManagePage(props: {
  organizationId: string;
}): ReactElement {
  return (
    <>
      <Meta title="Manage Subscription" />
      <RenderIfStripeAvailable organizationId={props.organizationId}>
        <ManageSubscriptionPageContent organizationId={props.organizationId} />
      </RenderIfStripeAvailable>
    </>
  );
}
