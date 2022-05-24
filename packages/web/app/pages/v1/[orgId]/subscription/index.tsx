import React from 'react';
import 'twin.macro';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { OrganizationView } from '@/components/organization/View';
import { OrganizationUsageEstimationView } from '@/components/organization/Usage';
import { OrganizationFieldsFragment, OrgBillingInfoFieldsFragment, OrgRateLimitFieldsFragment } from '@/graphql';
import { Card, Page } from '@/components/common';
import { BillingView } from '@/components/organization/billing/Billing';
import { Button, Stat, StatHelpText, StatLabel, StatNumber } from '@chakra-ui/react';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { InvoicesList } from '@/components/organization/billing/InvoicesList';
import { CurrencyFormatter } from '@/components/organization/billing/helpers';
import { RateLimitWarn } from '@/components/organization/billing/RateLimitWarn';

const Inner: React.FC<{
  organization: OrganizationFieldsFragment & OrgBillingInfoFieldsFragment & OrgRateLimitFieldsFragment;
}> = ({ organization }) => {
  const router = useRouteSelector();
  const canAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: organization?.me,
    redirect: true,
  });

  if (!canAccess) {
    return null;
  }

  return (
    <Page
      title={'Subscription'}
      subtitle={'Information about your Hive plan, subscription, usage and data ingestion.'}
      actions={
        <Button
          colorScheme="primary"
          type="button"
          size="sm"
          as="a"
          href={`/${router.organizationId}/subscription/manage`}
        >
          Manage Subscription
        </Button>
      }
    >
      <RateLimitWarn organization={organization} />
      <div tw="w-full flex flex-row">
        <div tw="flex-grow mr-12">
          <div tw="flex flex-col space-y-6 pb-6">
            <Card.Root>
              <Card.Title>Plan and Reserved Volume</Card.Title>
              <Card.Content>
                <BillingView organization={organization}>
                  {organization.billingConfiguration?.upcomingInvoice ? (
                    <Stat tw="mb-4">
                      <StatLabel>Next Invoice</StatLabel>
                      <StatNumber>
                        {CurrencyFormatter.format(organization.billingConfiguration.upcomingInvoice.amount)}
                      </StatNumber>
                      <StatHelpText>{organization.billingConfiguration.upcomingInvoice.date}</StatHelpText>
                    </Stat>
                  ) : null}
                </BillingView>
              </Card.Content>
            </Card.Root>
          </div>
        </div>
        <div tw="flex-grow-0 w-5/12">
          <Card.Root>
            <Card.Title>Monthly Usage Overview</Card.Title>
            <Card.Content>
              <OrganizationUsageEstimationView organization={organization} />
            </Card.Content>
          </Card.Root>
        </div>
      </div>
      {organization.billingConfiguration?.invoices?.length > 0 ? (
        <Card.Root>
          <Card.Title>Invoices</Card.Title>
          <Card.Content>
            <InvoicesList organization={organization} />
          </Card.Content>
        </Card.Root>
      ) : null}
    </Page>
  );
};

export default function SubscriptionPage() {
  return (
    <OrganizationView title="Subscription & Usage" includeBilling={true} includeRateLimit={true}>
      {({ organization }) => <Inner organization={organization} />}
    </OrganizationView>
  );
}
