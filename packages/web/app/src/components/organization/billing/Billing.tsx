import { ReactNode } from 'react';
import { FragmentType, graphql, useFragment } from '@/gql';
import { PlanSummary } from './PlanSummary';

const BillingView_OrganizationFragment = graphql(`
  fragment BillingView_OrganizationFragment on Organization {
    id
    slug
    plan
    rateLimit {
      retentionInDays
      operations
    }
  }
`);

const BillingView_QueryFragment = graphql(`
  fragment BillingView_QueryFragment on Query {
    billingPlans {
      planType
      ...PlanSummary_PlanFragment
    }
  }
`);

export function BillingView(props: {
  children: ReactNode;
  organization: FragmentType<typeof BillingView_OrganizationFragment>;
  query: FragmentType<typeof BillingView_QueryFragment>;
}) {
  const organization = useFragment(BillingView_OrganizationFragment, props.organization);
  const query = useFragment(BillingView_QueryFragment, props.query);
  const plan = query.billingPlans.find(v => v.planType === organization.plan);

  if (plan == null) {
    return null;
  }

  return (
    <PlanSummary
      operationsRateLimit={Math.floor(organization.rateLimit.operations / 1_000_000)}
      plan={plan}
    >
      {props.children}
    </PlanSummary>
  );
}
