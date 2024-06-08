import { useCallback, useEffect, useState } from 'react';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { OrganizationLayout, Page } from '@/components/layouts/organization';
import {
  PaddleCheckout_BillingPlansDetails,
  PaddleCheckout_OrgInfo,
  PaddleCheckout_UserInfo,
  PaddleCheckoutManager,
} from '@/components/organization/billing/PaddleCheckout';
import { useToast } from '@/components/ui/use-toast';
import { Card, Heading, Link, Modal, Spinner } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { BillingPlanType } from '@/gql/graphql';
import { getPaddleClientConfig } from '@/lib/billing/paddle-public-key';
import { CheckoutLineItem } from '@paddle/paddle-js';
import { useRouter } from '@tanstack/react-router';

const PADDLE_AVAILABLE = !!getPaddleClientConfig();

const SubscriptionMigratePageQuery = graphql(`
  query SubscriptionMigratePageQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        id
        cleanId
        plan
        billingConfiguration {
          provider
        }
        rateLimit {
          operations
        }
        ...PaddleCheckout_OrgInfo
      }
    }
    me {
      ...PaddleCheckout_UserInfo
    }
    billingPlans {
      id
      planType
      ...PaddleCheckout_BillingPlansDetails
    }
  }
`);

function SubscriptionMigratePage() {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: SubscriptionMigratePageQuery,
    pause: !PADDLE_AVAILABLE,
    variables: {
      selector: {
        organization: router.organizationId,
      },
    },
  });

  if (query.fetching || !query.data) {
    return null;
  }

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const organizationConnection = query.data?.organizations;

  if (
    !PADDLE_AVAILABLE ||
    !currentOrganization ||
    !me ||
    !organizationConnection ||
    currentOrganization.billingConfiguration.provider !== 'STRIPE'
  ) {
    void router.push({
      pathname: '/[organizationId]/view/subscription',
      query: {
        organizationId: router.organizationId,
      },
    });

    return null;
  }

  const proPlan = query.data.billingPlans.find(v => v.planType === BillingPlanType.Pro)!;

  return (
    <>
      <MetaTitle title="Subscription Migration" />
      <OrganizationLayout
        page={Page.Subscription}
        className="flex flex-col gap-y-10"
        currentOrganization={currentOrganization}
        organizations={organizationConnection}
        me={me}
      >
        <div className="grow pt-4">
          <Card>
            <Heading className="mb-2">Migrate from Stripe to Paddle</Heading>
            <p>
              Hive is replacing the payment/billing provider and migrating from Stripe to Paddle.
            </p>
            <p>
              To migrate your subscription, we will kindly ask you to re-enter your payment details.
            </p>
            <br />
            <p className="font-bold">
              This migration process needs to be done by June 30th, 2024. After this date,
              organizations that did not migrate will be downgraded to Hobby plan.
            </p>
            <br />
            <p>Your Hive subscription will be affected in the following way:</p>
            <ul className="list-disc pl-8">
              <li>
                <span className="font-bold">Monthly Bill Statement</span>: unlike Stripe,{' '}
                <Link
                  variant="primary"
                  target="_blank"
                  href="https://www.paddle.com/blog/what-is-merchant-of-record"
                >
                  Paddle is a Merchent Of Record
                </Link>
                . You'll notice that your monthly bill statement will be sent from Paddle, with the{' '}
                <pre className="inline">GUILD HIVE</pre> description.
              </li>
              <li>
                <span className="font-bold">Refund</span>: your current subscription will be
                prorated. You'll get a refund for the remaining time while we create your new
                subscription in Paddle.
              </li>
              <li>
                <span className="font-bold">Billing Cycle</span>: your billing cycle will reset and
                start from the day you migrate.
              </li>
              <li>
                <span className="font-bold">Past Invoices</span>: collect your past invoices from
                the{' '}
                <Link
                  variant="primary"
                  target="_blank"
                  href={{
                    pathname: '/[organizationId]/view/manage-subscription',
                    query: {
                      organizationId: router.organizationId,
                    },
                  }}
                >
                  subscription page
                </Link>
                . If you'll need a copy of a past invoice in the future, you can request it from
                Hive support.
              </li>
            </ul>
            <PaddleMigrationCheckoutForm
              me={query.data!.me}
              planPrices={proPlan}
              orgInfo={query.data!.organization!.organization}
              operationsInMillions={
                query.data.organization!.organization.rateLimit.operations / 1_000_000
              }
            />
          </Card>
        </div>
      </OrganizationLayout>
    </>
  );
}

export const PaddleMigrationCheckoutForm_VerifyProviderChange = graphql(`
  query PaddleMigrationCheckoutForm_VerifyProviderChange($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        id
        cleanId
        plan
        billingConfiguration {
          provider
        }
      }
    }
  }
`);

function PaddleMigrationCheckoutForm(props: {
  me: FragmentType<typeof PaddleCheckout_UserInfo>;
  planPrices: FragmentType<typeof PaddleCheckout_BillingPlansDetails>;
  orgInfo: FragmentType<typeof PaddleCheckout_OrgInfo>;
  operationsInMillions: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const prices = useFragment(PaddleCheckout_BillingPlansDetails, props.planPrices);
  const org = useFragment(PaddleCheckout_OrgInfo, props.orgInfo);
  const user = useFragment(PaddleCheckout_UserInfo, props.me);
  const [polling, setPolling] = useState(false);
  const [verifyProviderChangesQuery, refetchProviderChanges] = useQuery({
    query: PaddleMigrationCheckoutForm_VerifyProviderChange,
    variables: {
      selector: {
        organization: org.name,
      },
    },
    requestPolicy: 'network-only',
    pause: !org || !props.orgInfo || !polling,
  });

  useEffect(() => {
    if (
      polling &&
      verifyProviderChangesQuery.data?.organization?.organization.plan === 'PRO' &&
      verifyProviderChangesQuery.data?.organization?.organization.billingConfiguration?.provider ===
        'PADDLE'
    ) {
      toast({
        title: 'Subscription Migrated',
        description: 'Your subscription has been successfully migrated to Paddle.',
      });

      setTimeout(() => {
        void router.navigate({
          to: '/$organizationId/view/manage-subscription',
          params: {
            organizationId: verifyProviderChangesQuery.data?.organization?.organization.id,
          },
        });
      }, 1000);
    }
  }, [verifyProviderChangesQuery.data?.organization?.organization.plan, polling]);

  useEffect(() => {
    if (polling) {
      const interval = setInterval(() => {
        refetchProviderChanges();
      }, 3000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [polling, refetchProviderChanges]);

  if (!prices.basePrice?.id || !prices.pricePerOperationsUnit?.id) {
    return null;
  }

  const items: CheckoutLineItem[] = [
    {
      priceId: prices.basePrice.id,
      quantity: 1,
    },
    {
      priceId: prices.pricePerOperationsUnit.id,
      quantity: props.operationsInMillions,
    },
  ];

  const onCheckoutCompleted = useCallback(() => {
    setPolling(true);
  }, [setPolling]);

  return (
    <>
      <Modal hideCloseButton open={polling} onOpenChange={() => {}} className="flex flex-col gap-3">
        <Heading className="text-center">Verifying your Hive Pro subscription...</Heading>
        <p>This may take a few seconds.</p>
        <p>
          If you are having trouble with your subscription, please{' '}
          <Link target="_blank" variant="primary" href={`/${org.cleanId}/view/support`}>
            contact support
          </Link>
          .
        </p>
        <div className="flex flex-col items-center">
          <Spinner />
        </div>
      </Modal>
      <PaddleCheckoutManager
        items={items}
        orgName={org.name}
        organizationId={org.id}
        userEmail={user.email}
        onCheckoutCompleted={onCheckoutCompleted}
        customData={{
          hiveSubscription: true,
          organizationId: org.id,
          migration: true,
        }}
      />
    </>
  );
}

export default authenticated(SubscriptionMigratePage);
