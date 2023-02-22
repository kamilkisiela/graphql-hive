import { ReactNode } from 'react';
import { useQuery } from 'urql';
import { DataWrapper } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { BillingPlansDocument } from '@/graphql';
import { PlanSummary } from './PlanSummary';

const BillingView_OrganizationFragment = graphql(`
  fragment BillingView_OrganizationFragment on Organization {
    plan
    rateLimit {
      retentionInDays
      operations
    }
  }
`);

export function BillingView(props: {
  children: ReactNode;
  organization: FragmentType<typeof BillingView_OrganizationFragment>;
}) {
  const organization = useFragment(BillingView_OrganizationFragment, props.organization);
  const [query] = useQuery({ query: BillingPlansDocument });

  return (
    <DataWrapper query={query}>
      {result => {
        const plan = result.data.billingPlans.find(v => v.planType === organization.plan);

        if (plan == null) {
          return null;
        }

        return (
          <PlanSummary
            retentionInDays={organization.rateLimit.retentionInDays}
            operationsRateLimit={Math.floor(organization.rateLimit.operations / 1_000_000)}
            plan={plan}
          >
            {props.children}
          </PlanSummary>
        );
      }}
    </DataWrapper>
  );
}
