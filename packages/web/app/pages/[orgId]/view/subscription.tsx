import { ReactElement } from 'react';
import NextLink from 'next/link';
import { endOfMonth, startOfMonth } from 'date-fns';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { OrganizationLayout } from '@/components/layouts/organization';
import { BillingView } from '@/components/organization/billing/Billing';
import { CurrencyFormatter } from '@/components/organization/billing/helpers';
import { InvoicesList } from '@/components/organization/billing/InvoicesList';
import { OrganizationUsageEstimationView } from '@/components/organization/Usage';
import { Button } from '@/components/ui/button';
import { Card, Heading, Stat, Title } from '@/components/v2';
import { graphql, useFragment } from '@/gql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { getIsStripeEnabled } from '@/lib/billing/stripe-public-key';
import { useRouteSelector } from '@/lib/hooks';
import { useNotFoundRedirectOnError } from '@/lib/hooks/use-not-found-redirect-on-error';
import { withSessionProtection } from '@/lib/supertokens/guard';

const DateFormatter = Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

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

const SubscriptionPageQuery = graphql(`
  query SubscriptionPageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        cleanId
        ...OrganizationLayout_CurrentOrganizationFragment
        ...SubscriptionPage_OrganizationFragment
      }
    }
    ...SubscriptionPage_QueryFragment
    organizations {
      ...OrganizationLayout_OrganizationConnectionFragment
    }
    me {
      ...OrganizationLayout_MeFragment
    }
  }
`);

function SubscriptionPageContent() {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: SubscriptionPageQuery,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });

  useNotFoundRedirectOnError(!!query.error);

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const organizationConnection = query.data?.organizations;

  const organization = useFragment(SubscriptionPage_OrganizationFragment, currentOrganization);
  const queryForBilling = useFragment(SubscriptionPage_QueryFragment, query.data);
  const canAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: organization?.me ?? null,
    redirect: true,
  });

  if (query.error || query.fetching) {
    return null;
  }

  if (!currentOrganization || !me || !organizationConnection || !organization || !queryForBilling) {
    return null;
  }

  if (!canAccess) {
    return null;
  }

  const today = new Date();
  const start = startOfMonth(today);
  const end = endOfMonth(today);

  return (
    <OrganizationLayout
      value="subscription"
      className="flex flex-col gap-y-10"
      currentOrganization={currentOrganization}
      organizations={organizationConnection}
      me={me}
    >
      <div className="grow">
        <div className="py-6 flex flex-row justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Your subscription</h3>
            <p className="text-sm text-gray-400">Explore your current plan and usage.</p>
          </div>
          <div>
            <Button asChild>
              <NextLink href={`/${currentOrganization.cleanId}/view/manage-subscription`}>
                Manage subscription
              </NextLink>
            </Button>
          </div>
        </div>
        <div>
          <Card>
            <Heading className="mb-2">Your current plan</Heading>
            <div>
              <BillingView organization={organization} query={queryForBilling}>
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
        </div>
      </div>
    </OrganizationLayout>
  );
}

function SubscriptionPage(): ReactElement {
  return (
    <>
      <Title title="Subscription & Usage" />
      <SubscriptionPageContent />
    </>
  );
}

export const getServerSideProps = withSessionProtection(async context => {
  /**
   * If Stripe is not enabled we redirect the user to the organization.
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
