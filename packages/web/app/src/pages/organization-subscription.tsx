import { ReactElement, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useQuery } from 'urql';
import { OrganizationLayout, Page } from '@/components/layouts/organization';
import { BillingView } from '@/components/organization/billing/Billing';
import { CurrencyFormatter } from '@/components/organization/billing/helpers';
import { InvoicesList } from '@/components/organization/billing/InvoicesList';
import { RenderIfStripeAvailable } from '@/components/organization/stripe';
import { OrganizationUsageEstimationView } from '@/components/organization/Usage';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { Card } from '@/components/v2/card';
import Stat from '@/components/v2/stat';
import { graphql, useFragment } from '@/gql';
import { OrganizationAccessScope, useOrganizationAccess } from '@/lib/access/organization';
import { getIsPaddleEnabled } from '@/lib/billing/paddle-public-key';
import { formatNumber } from '@/lib/hooks';
import { useChartStyles } from '@/utils';
import { Link, useRouter } from '@tanstack/react-router';

const DateFormatter = Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const numberFormatter = Intl.NumberFormat('en-US');

const SubscriptionPage_OrganizationFragment = graphql(`
  fragment SubscriptionPage_OrganizationFragment on Organization {
    id
    cleanId
    me {
      ...CanAccessOrganization_MemberFragment
    }
    billingConfiguration {
      hasPaymentIssues
      canUpdateSubscription
      invoices {
        id
      }
      nextPayment {
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
        ...SubscriptionPage_OrganizationFragment
      }
    }
    ...SubscriptionPage_QueryFragment
    monthlyUsage(selector: $selector) {
      date
      total
    }
  }
`);

function SubscriptionPageContent(props: { organizationId: string }) {
  const router = useRouter();

  if (!getIsPaddleEnabled()) {
    void router.navigate({
      to: '/$organizationId',
      params: {
        organizationId: props.organizationId,
      },
    });

    return null;
  }

  const [query] = useQuery({
    query: SubscriptionPageQuery,
    variables: {
      selector: {
        organization: props.organizationId,
      },
    },
  });

  const currentOrganization = query.data?.organization?.organization;

  const organization = useFragment(SubscriptionPage_OrganizationFragment, currentOrganization);
  const queryForBilling = useFragment(SubscriptionPage_QueryFragment, query.data);
  const styles = useChartStyles();
  const canAccess = useOrganizationAccess({
    scope: OrganizationAccessScope.Settings,
    member: organization?.me ?? null,
    redirect: true,
    organizationId: props.organizationId,
  });

  const monthlyUsage = query.data?.monthlyUsage ?? [];
  const monthlyUsagePoints: [string, number][] = useMemo(
    () => monthlyUsage.map(v => [v.date, v.total]),
    [monthlyUsage],
  );

  if (query.error) {
    return <QueryError organizationId={props.organizationId} error={query.error} />;
  }

  if (query.fetching) {
    return null;
  }

  if (!currentOrganization || !organization || !queryForBilling) {
    return null;
  }

  if (!canAccess) {
    return null;
  }

  return (
    <OrganizationLayout
      page={Page.Subscription}
      organizationId={props.organizationId}
      className="flex flex-col gap-y-10"
    >
      <div className="grow">
        <div className="flex flex-row items-center justify-between py-6">
          <div>
            <Title>Your subscription</Title>
            <Subtitle>Explore your current plan and usage.</Subtitle>
          </div>
          <div>
            <Button asChild>
              <Link
                to="/$organizationId/view/manage-subscription"
                params={{ organizationId: currentOrganization.cleanId }}
              >
                Manage subscription
              </Link>
            </Button>
          </div>
        </div>
        <div>
          <Card>
            <Heading className="mb-2">Your current plan</Heading>
            <div>
              <BillingView organization={organization} query={queryForBilling}>
                {organization.billingConfiguration?.nextPayment && (
                  <Stat>
                    <Stat.Label>Next Invoice</Stat.Label>
                    <Stat.Number>
                      {CurrencyFormatter.format(
                        organization.billingConfiguration.nextPayment.amount,
                      )}
                    </Stat.Number>
                    <Stat.HelpText>
                      {DateFormatter.format(
                        new Date(organization.billingConfiguration.nextPayment.date),
                      )}
                    </Stat.HelpText>
                  </Stat>
                )}
              </BillingView>
            </div>
          </Card>
          <Card className="mt-8">
            <Heading>Current Usage</Heading>
            <OrganizationUsageEstimationView organization={organization} />
          </Card>
          {monthlyUsagePoints.length ? (
            <Card className="mt-8">
              <Heading>Historical Usage</Heading>
              <p className="text-sm text-gray-500">
                Based on monthly usage data. This information can help you to understand your
                average usage per month.
              </p>
              <div className="mt-4">
                <AutoSizer disableHeight>
                  {size => (
                    <ReactECharts
                      style={{ width: size.width, height: 400 }}
                      option={{
                        ...styles,
                        grid: {
                          left: 20,
                          top: 50,
                          right: 20,
                          bottom: 20,
                          containLabel: true,
                        },
                        legend: {
                          show: false,
                        },
                        tooltip: {
                          trigger: 'axis',
                          valueFormatter: (value: number) => formatNumber(value),
                          formatter(params: any[]) {
                            const param = params[0];
                            const value = param.data[1];

                            return `<strong>${numberFormatter.format(value)}</strong>`;
                          },
                        },
                        xAxis: [
                          {
                            type: 'time',
                            splitNumber: 12,
                          },
                        ],
                        yAxis: [
                          {
                            type: 'value',
                            boundaryGap: false,
                            min: 0,
                            axisLabel: {
                              formatter: (value: number) => formatNumber(value),
                            },
                            splitLine: {
                              lineStyle: {
                                color: '#595959',
                                type: 'dashed',
                              },
                            },
                          },
                        ],
                        series: [
                          {
                            type: 'bar',
                            name: 'Events',
                            showSymbol: false,
                            boundaryGap: false,
                            color: '#595959',
                            areaStyle: {},
                            emphasis: {
                              focus: 'series',
                            },
                            data: monthlyUsagePoints,
                          },
                        ],
                      }}
                    />
                  )}
                </AutoSizer>
              </div>
            </Card>
          ) : null}
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

export function OrganizationSubscriptionPage(props: { organizationId: string }): ReactElement {
  return (
    <>
      <Meta title="Subscription & Usage" />
      <RenderIfStripeAvailable organizationId={props.organizationId}>
        <SubscriptionPageContent organizationId={props.organizationId} />
      </RenderIfStripeAvailable>
    </>
  );
}
