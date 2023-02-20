import { ReactNode } from 'react';
import { useQuery } from 'urql';
import { DataWrapper } from '@/components/v2';
import {
  BillingPlansDocument,
  OrganizationFieldsFragment,
  OrgBillingInfoFieldsFragment,
} from '@/graphql';
import { PlanSummary } from './PlanSummary';

export function BillingView({
  organization,
  children,
}: {
  children: ReactNode;
  organization: OrganizationFieldsFragment & OrgBillingInfoFieldsFragment;
}) {
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
            {children}
          </PlanSummary>
        );
      }}
    </DataWrapper>
  );
}
