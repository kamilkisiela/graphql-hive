import { ReactElement } from 'react';
import dynamic from 'next/dynamic';
import { endOfMonth, startOfMonth } from 'date-fns';
import { authenticated } from '@/components/authenticated-container';
import { OrganizationLayout } from '@/components/layouts';
import { BillingView } from '@/components/organization/billing/Billing';
import { CurrencyFormatter } from '@/components/organization/billing/helpers';
import { InvoicesList } from '@/components/organization/billing/InvoicesList';
import { RateLimitWarn } from '@/components/organization/billing/RateLimitWarn';
import { OrganizationUsageEstimationView } from '@/components/organization/Usage';
import { Card, Heading, Stat, Tabs, Title } from '@/components/v2';
import {
  OrganizationFieldsFragment,
  OrgBillingInfoFieldsFragment,
  OrgRateLimitFieldsFragment,
} from '@/graphql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { getIsStripeEnabled } from '@/lib/billing/stripe-public-key';
import { withSessionProtection } from '@/lib/supertokens/guard';

const DateFormatter = Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const ManagePage = dynamic(() => import('./manage'));

function Page({
  organization,
}: {
  organization: OrganizationFieldsFragment &
    OrgBillingInfoFieldsFragment &
    OrgRateLimitFieldsFragment;
}): ReactElement | null {
  const canAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: organization?.me,
    redirect: true,
  });

  if (!canAccess) {
    return null;
  }

  const today = new Date();
  const start = startOfMonth(today);
  const end = endOfMonth(today);

  return (
    <Tabs defaultValue="overview">
      <Tabs.List>
        <Tabs.Trigger value="overview" hasBorder={false}>
          Monthly Usage
        </Tabs.Trigger>
        <Tabs.Trigger value="manage" hasBorder={false}>
          Manage
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="overview">
        <p className="mb-3 font-light text-gray-300">
          Information about your Hive plan, subscription, usage and data ingestion
        </p>
        <RateLimitWarn organization={organization} />
        <Card className="mt-8">
          <Heading className="mb-2">Plan and Reserved Volume</Heading>
          <div>
            <BillingView organization={organization}>
              {organization.billingConfiguration?.upcomingInvoice && (
                <Stat>
                  <Stat.Label>Next Invoice</Stat.Label>
                  <Stat.Number>
                    {CurrencyFormatter.format(
                      organization.billingConfiguration.upcomingInvoice.amount,
                    )}
                  </Stat.Number>
                  <Stat.HelpText>
                    {DateFormatter.format(
                      new Date(organization.billingConfiguration.upcomingInvoice.date),
                    )}
                  </Stat.HelpText>
                </Stat>
              )}
            </BillingView>
          </div>
        </Card>
        <Card className="mt-8">
          <Heading>Current Usage</Heading>
          <p className="text-sm text-gray-500">
            {DateFormatter.format(start)} — {DateFormatter.format(end)}
          </p>
          <div className="mt-4">
            <OrganizationUsageEstimationView organization={organization} />
          </div>
        </Card>
        {organization.billingConfiguration?.invoices?.length ? (
          <Card className="mt-8">
            <Heading>Invoices</Heading>
            <div className="mt-4">
              <InvoicesList organization={organization} />
            </div>
          </Card>
        ) : null}
      </Tabs.Content>
      <Tabs.Content value="manage">
        <ManagePage />
      </Tabs.Content>
    </Tabs>
  );
}

function SubscriptionPage(): ReactElement {
  return (
    <>
      <Title title="Subscription & Usage" />
      <OrganizationLayout value="subscription" includeBilling includeRateLimit>
        {({ organization }) => <Page organization={organization} />}
      </OrganizationLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection(async context => {
  /**
   * If Strive is not enabled we redirect the user to the organization.
   */
  const isStripeEnabled = getIsStripeEnabled();
  if (!isStripeEnabled) {
    const parts = String(context.resolvedUrl).split('/');
    parts.pop();
    return {
      redirect: {
        destination: parts.join('/'),
        permanent: false,
      },
    };
  }
  return { props: {} };
});

export default authenticated(SubscriptionPage);
