import { ReactElement } from 'react';
import dynamic from 'next/dynamic';
import 'twin.macro';
import { Stat, StatHelpText, StatLabel, StatNumber } from '@chakra-ui/react';

import { Card } from '@/components/common';
import { OrganizationLayout } from '@/components/layouts';
import { BillingView } from '@/components/organization/billing/Billing';
import { CurrencyFormatter } from '@/components/organization/billing/helpers';
import { InvoicesList } from '@/components/organization/billing/InvoicesList';
import { RateLimitWarn } from '@/components/organization/billing/RateLimitWarn';
import { OrganizationUsageEstimationView } from '@/components/organization/Usage';
import { OrganizationView } from '@/components/organization/View';
import { Tabs } from '@/components/v2';
import {
  OrganizationFieldsFragment,
  OrgBillingInfoFieldsFragment,
  OrgRateLimitFieldsFragment,
} from '@/graphql';
import {
  OrganizationAccessScope,
  useOrganizationAccess,
} from '@/lib/access/organization';

const ManagePage = dynamic(() => import('./manage'));

const Page = ({
  organization,
}: {
  organization: OrganizationFieldsFragment &
    OrgBillingInfoFieldsFragment &
    OrgRateLimitFieldsFragment;
}): ReactElement => {
  const canAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: organization?.me,
    redirect: true,
  });

  if (!canAccess) {
    return null;
  }

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
          Information about your Hive plan, subscription, usage and data
          ingestion
        </p>
        <RateLimitWarn organization={organization} />
        <div className="flex w-full flex-row">
          <div className="mr-12 grow">
            <div className="flex flex-col space-y-6 pb-6">
              <Card.Root>
                <Card.Title>Plan and Reserved Volume</Card.Title>
                <Card.Content>
                  <BillingView organization={organization}>
                    {organization.billingConfiguration?.upcomingInvoice && (
                      <Stat tw="mb-4">
                        <StatLabel>Next Invoice</StatLabel>
                        <StatNumber>
                          {CurrencyFormatter.format(
                            organization.billingConfiguration.upcomingInvoice
                              .amount
                          )}
                        </StatNumber>
                        <StatHelpText>
                          {
                            organization.billingConfiguration.upcomingInvoice
                              .date
                          }
                        </StatHelpText>
                      </Stat>
                    )}
                  </BillingView>
                </Card.Content>
              </Card.Root>
            </div>
          </div>
          <div className="w-5/12 grow-0">
            <Card.Root>
              <Card.Title>Monthly Usage Overview</Card.Title>
              <Card.Content>
                <OrganizationUsageEstimationView organization={organization} />
              </Card.Content>
            </Card.Root>
          </div>
        </div>
        {organization.billingConfiguration?.invoices?.length > 0 && (
          <Card.Root>
            <Card.Title>Invoices</Card.Title>
            <Card.Content>
              <InvoicesList organization={organization} />
            </Card.Content>
          </Card.Root>
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
    <OrganizationLayout value="subscription">
      <OrganizationView
        title="Subscription & Usage"
        includeBilling
        includeRateLimit
      >
        {({ organization }) => <Page organization={organization} />}
      </OrganizationView>
    </OrganizationLayout>
  );
}
