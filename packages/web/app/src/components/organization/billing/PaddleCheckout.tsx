import { ReactElement, useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { useQuery } from 'urql';
import { Heading, Link, Modal, Spinner } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { usePaddle } from '@/lib/billing/paddle';
import {
  CheckoutEventNames,
  CheckoutSettings,
  type CheckoutLineItem,
  type PaddleEventData,
} from '@paddle/paddle-js';

const targetElementIdentifier = 'paddle-checkout-container';

export const PADDLE_SETTINGS: CheckoutSettings = {
  displayMode: 'inline',
  frameInitialHeight: 450,
  frameStyle: 'width: 100%; min-width: 312px; background-color: transparent; border: none;',
  showAddDiscounts: true,
  showAddTaxId: true,
  allowLogout: false,
  theme: 'dark',
  allowedPaymentMethods: ['card', 'paypal', 'apple_pay', 'google_pay'],
};

export const PaddleCheckoutManager = (props: {
  items: CheckoutLineItem[];
  orgName: string;
  userEmail: string;
  organizationId: string;
  customData: Record<string, any>;
  onCheckoutCompleted?: (data: PaddleEventData) => void;
}) => {
  const paddle = usePaddle();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      paddle.instance.Checkout.updateItems(props.items);
    }
  }, [props.items.map(item => item.quantity)]);

  useEffect(() => {
    if (!paddle.enabled || !paddle.instance || !paddle.instance.Initialized) {
      return;
    }

    paddle.instance.Update({
      eventCallback: data => {
        if (data.name === CheckoutEventNames.CHECKOUT_COMPLETED && props.onCheckoutCompleted) {
          props.onCheckoutCompleted(data);
        }
      },
    });

    paddle.instance.Checkout.open({
      items: props.items,
      customer: {
        email: props.userEmail,
        business: {
          name: props.orgName,
          taxIdentifier: '',
        },
      },
      customData: props.customData,
      settings: {
        ...PADDLE_SETTINGS,
        frameTarget: targetElementIdentifier,
      },
    });
    setIsOpen(true);

    return () => {
      if (isOpen && paddle?.instance) {
        paddle.instance.Checkout.close();
      }

      paddle?.instance?.Update({
        eventCallback: undefined,
      });
    };
  }, []);

  if (!paddle.enabled || !paddle.instance) {
    return null;
  }

  return <div className={clsx(targetElementIdentifier, 'w-[550px]')} />;
};

export const PaddleCheckout_OrgInfo = graphql(`
  fragment PaddleCheckout_OrgInfo on Organization {
    id
    cleanId
    name
  }
`);

export const PaddleCheckout_UserInfo = graphql(`
  fragment PaddleCheckout_UserInfo on User {
    id
    email
  }
`);

export const PaddleCheckout_BillingPlansDetails = graphql(`
  fragment PaddleCheckout_BillingPlansDetails on BillingPlan {
    id
    basePrice {
      id
      amount
    }
    pricePerOperationsUnit {
      id
      amount
    }
  }
`);

export const PaddleCheckoutForm_VerifyPlanChange = graphql(`
  query PaddleCheckoutForm_VerifyPlanChange($selector: OrganizationSelectorInput!) {
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

export const PaddleCheckoutForm = ({
  me,
  orgInfo,
  planPrices,
  operationsInMillions,
}: {
  me: FragmentType<typeof PaddleCheckout_UserInfo>;
  orgInfo: FragmentType<typeof PaddleCheckout_OrgInfo>;
  planPrices: FragmentType<typeof PaddleCheckout_BillingPlansDetails>;
  operationsInMillions: number;
}): ReactElement | null => {
  const org = useFragment(PaddleCheckout_OrgInfo, orgInfo);
  const [polling, setPolling] = useState(false);
  const [verifyPlanChangesQuery, refetchPlanChanges] = useQuery({
    query: PaddleCheckoutForm_VerifyPlanChange,
    variables: {
      selector: {
        organization: org.name,
      },
    },
    requestPolicy: 'network-only',
    pause: !org || !orgInfo || !polling,
  });

  useEffect(() => {
    if (polling && verifyPlanChangesQuery.data?.organization?.organization.plan === 'PRO') {
      setPolling(false);
    }
  }, [verifyPlanChangesQuery.data?.organization?.organization.plan, polling]);

  useEffect(() => {
    if (polling) {
      const interval = setInterval(() => {
        refetchPlanChanges();
      }, 3000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [polling, refetchPlanChanges]);

  const prices = useFragment(PaddleCheckout_BillingPlansDetails, planPrices);
  const user = useFragment(PaddleCheckout_UserInfo, me);

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
      quantity: operationsInMillions,
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
        }}
      />
    </>
  );
};
