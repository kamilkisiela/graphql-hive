import { ReactElement } from 'react';
import { Callout } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';

const RateLimitWarn_OrganizationFragment = graphql(`
  fragment RateLimitWarn_OrganizationFragment on Organization {
    name
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

  return (
    <Callout type="warning" className="w-1/2">
      <b>Your organization is being rate-limited for operations.</b>
      <br />
      Since you reached your organization rate-limit and data ingestion limitation, your
      organization <b>{organization.name}</b> is currently unable to ingest data.
    </Callout>
  );
}
