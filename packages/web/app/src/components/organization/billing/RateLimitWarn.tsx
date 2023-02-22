import { ReactElement } from 'react';
import { Callout } from '@/components/v2';
import { OrgRateLimitFieldsFragment } from '@/graphql';

export function RateLimitWarn({
  organization,
}: {
  organization: OrgRateLimitFieldsFragment;
}): ReactElement | null {
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
