import { PropsWithChildren } from 'react';
import { useQuery } from 'urql';
import { DataWrapper } from '@/components/common/DataWrapper';
import {
  BillingPlansDocument,
  OrganizationFieldsFragment,
  OrgBillingInfoFieldsFragment,
} from '@/graphql';
import { PlanSummary } from './PlanSummary';

export const BillingView = ({
  organization,
  children,
}: PropsWithChildren<{
  organization: OrganizationFieldsFragment & OrgBillingInfoFieldsFragment;
}>) => {
  const [query] = useQuery({
    query: BillingPlansDocument,
  });

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
};
