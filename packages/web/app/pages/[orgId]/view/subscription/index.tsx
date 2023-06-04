import { ReactElement } from 'react';
import dynamic from 'next/dynamic';
import { endOfMonth, startOfMonth } from 'date-fns';
import { authenticated } from '@/components/authenticated-container';
import { OrganizationLayout } from '@/components/layouts';
import { BillingView } from '@/components/organization/billing/Billing';
import { CurrencyFormatter } from '@/components/organization/billing/helpers';
import { InvoicesList } from '@/components/organization/billing/InvoicesList';
import { OrganizationUsageEstimationView } from '@/components/organization/Usage';
import { Card, Heading, Stat, Tabs, Title } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { getIsStripeEnabled } from '@/lib/billing/stripe-public-key';
import { withSessionProtection } from '@/lib/supertokens/guard';

const DateFormatter = Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const ManagePage = dynamic(() => import('./manage'));

const SubscriptionPage_OrganizationFragment = graphql(`
  fragment SubscriptionPage_OrganizationFragment on Organization {
    me {
      ...CanAccessOrganization_MemberFragment
    }
    billingConfiguration {
      hasPaymentIssues
      invoices {
        id
      }
      upcomingInvoice {
        amount
        date
      }
    }
    ...RateLimitWarn_OrganizationFragment
    ...OrganizationInvoicesList_OrganizationFragment
    ...BillingView_OrganizationFragment
    ...OrganizationUsageEstimationView_OrganizationFragment
  }
`);

const SubscriptionPage_QueryFragment = graphql(`
  fragment SubscriptionPage_QueryFragment on Query {
    ...BillingView_QueryFragment
  }
`);

function Page(props: {
  organization: FragmentType<typeof SubscriptionPage_OrganizationFragment>;
  query: FragmentType<typeof SubscriptionPage_QueryFragment>;
}): ReactElement | null {
  const organization = useFragment(SubscriptionPage_OrganizationFragment, props.organization);
  const query = useFragment(SubscriptionPage_QueryFragment, props.query);
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
        <Card>
          <Heading className="mb-2">Your current plan</Heading>
          <div>
            <BillingView organization={organization} query={query}>
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

const SubscriptionPageQuery = graphql(`
  query SubscriptionPageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        ...OrganizationLayout_OrganizationFragment
        ...SubscriptionPage_OrganizationFragment
      }
    }
    ...SubscriptionPage_QueryFragment
  }
`);

function SubscriptionPage(): ReactElement {
  return (
    <>
      <Title title="Subscription & Usage" />
      <OrganizationLayout value="subscription" query={SubscriptionPageQuery}>
        {props =>
          props.organization ? (
            <Page organization={props.organization.organization} query={props} />
          ) : null
        }
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
