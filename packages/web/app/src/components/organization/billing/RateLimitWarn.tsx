import { ReactElement } from 'react';
import { Callout } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { BillingPlanType } from '@/graphql';

const RateLimitWarn_OrganizationFragment = graphql(`
  fragment RateLimitWarn_OrganizationFragment on Organization {
    name
    plan
    rateLimit {
      limitedForOperations
    }
  }
`);

export function RateLimitWarn(props: {
  organization: FragmentType<typeof RateLimitWarn_OrganizationFragment>;
}): ReactElement | null {
  const organization = useFragment(RateLimitWarn_OrganizationFragment, props.organization);
  if (!organization.rateLimit.limitedForOperations) {
    return null;
  }

  if (organization.plan === BillingPlanType.Enterprise) {
    return (
      <Callout type="warning" className="w-full">
        <b>Your organization has reached it's contract limit.</b>
        <br />
        The data in your organization <b>{organization.name}</b> is still being processed and no
        data will be lost.
        <br />
        Please contact our support team to increase your contract limit.
      </Callout>
    );
  }

  return (
    <Callout type="warning" className="w-full">
      <b>Your organization is being rate-limited for operations.</b>
      <br />
      Since you have reached your organization rate-limit and data ingestion limitation, your
      organization <b>{organization.name}</b> is currently unable to ingest data.
    </Callout>
  );
}
