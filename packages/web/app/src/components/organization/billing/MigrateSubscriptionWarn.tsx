import { ReactElement } from 'react';
import { Callout, Link } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';

const MigrateSubscriptionWarn_OrganizationFragment = graphql(`
  fragment MigrateSubscriptionWarn_OrganizationFragment on Organization {
    id
    cleanId
    plan
    billingConfiguration {
      provider
    }
  }
`);

export function MigrateSubscriptionWarn(props: {
  organization: FragmentType<typeof MigrateSubscriptionWarn_OrganizationFragment>;
}): ReactElement | null {
  const organization = useFragment(
    MigrateSubscriptionWarn_OrganizationFragment,
    props.organization,
  );

  if (organization.billingConfiguration.provider !== 'STRIPE') {
    return null;
  }

  return (
    <Callout type="warning" className="mb-2 w-full">
      <b>Your organization's payment method needs to be updated.</b>
      <br />
      Hive is migrating to a new billing provider (Paddle).{' '}
      <Link
        variant="primary"
        href={{
          pathname: '/[organizationId]/view/migrate-subscription',
          query: {
            organizationId: organization.cleanId,
          },
        }}
      >
        Please migrate your subscription to continue using Hive services and avoid any service
        interruptions.
      </Link>{' '}
    </Callout>
  );
}
