import { ReactElement } from 'react';
import dynamic from 'next/dynamic';
import { Stat, StatHelpText, StatLabel, StatNumber } from '@chakra-ui/react';
import { endOfMonth, startOfMonth } from 'date-fns';

import { OrganizationLayout } from '@/components/layouts';
import { BillingView } from '@/components/organization/billing/Billing';
import { CurrencyFormatter } from '@/components/organization/billing/helpers';
import { InvoicesList } from '@/components/organization/billing/InvoicesList';
import { RateLimitWarn } from '@/components/organization/billing/RateLimitWarn';
import { OrganizationUsageEstimationView } from '@/components/organization/Usage';
import { Card, Heading, Tabs, Title } from '@/components/v2';
import { OrganizationFieldsFragment, OrgBillingInfoFieldsFragment, OrgRateLimitFieldsFragment } from '@/graphql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';

const DateFormatter = Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const ManagePage = dynamic(() => import('./manage'));

const Page = ({
  organization,
}: {
  organization: OrganizationFieldsFragment & OrgBillingInfoFieldsFragment & OrgRateLimitFieldsFragment;
}): ReactElement => {
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
                <Stat className="mb-4">
                  <StatLabel>Next Invoice</StatLabel>
                  <StatNumber>
                    {CurrencyFormatter.format(organization.billingConfiguration.upcomingInvoice.amount)}
                  </StatNumber>
                  <StatHelpText>{organization.billingConfiguration.upcomingInvoice.date}</StatHelpText>
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
        {organization.billingConfiguration?.invoices?.length > 0 && (
          <Card>
            <Heading className="mb-2">Invoices</Heading>
            <div>
              <InvoicesList organization={organization} />
            </div>
          </Card>
        )}
      </Tabs.Content>
      <Tabs.Content value="manage">
        <ManagePage />
      </Tabs.Content>
    </Tabs>
  );
};

export default function SubscriptionPage(): ReactElement {
  return (
    <>
      <Title title="Subscription & Usage" />
      <OrganizationLayout value="subscription" includeBilling includeRateLimit>
        {({ organization }) => <Page organization={organization} />}
      </OrganizationLayout>
    </>
  );
}
