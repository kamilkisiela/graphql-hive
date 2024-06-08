import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useFormik } from 'formik';
import { useMutation, useQuery } from 'urql';
import * as Yup from 'yup';
import { useToast } from '@/components/ui/use-toast';
import {
  Button,
  Heading,
  Input,
  Link,
  Modal,
  Spinner,
  Table,
  TBody,
  Td,
  Tr,
} from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { usePaddle } from '@/lib/billing/paddle';
import { CheckoutEventNames } from '@paddle/paddle-js';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { PADDLE_SETTINGS } from './PaddleCheckout';

const GenerateManagementLinkMutation = graphql(`
  mutation GenerateManagementLinkMutation($selector: OrganizationSelectorInput!) {
    generateSubscriptionManagementLink(selector: $selector)
  }
`);

const PaddleGeneratePaymentMethodUpdateTokenMutation = graphql(`
  mutation generatePaymentMethodUpdateToken($selector: OrganizationSelectorInput!) {
    generatePaymentMethodUpdateToken(selector: $selector)
  }
`);

const BillingPaymentMethod_OrganizationFragment = graphql(`
  fragment BillingPaymentMethod_OrganizationFragment on Organization {
    id
    cleanId
    billingConfiguration {
      provider
      hasPaymentIssues
    }
  }
`);

const PaddleProviderSettings_UpdateBillingSettingsMutation = graphql(`
  mutation PaddleProviderSettings_UpdateBillingSettingsMutation(
    $input: UpdateBillingDetailsInput!
  ) {
    updateBillingDetails(input: $input) {
      id
      cleanId
      billingConfiguration {
        provider
        taxId
        legalName
        billingEmail
        paymentMethod {
          methodType
          brand
          identifier
        }
      }
    }
  }
`);

const PaddleProviderSettings_BillingSettingsQuery = graphql(`
  query PaddleProviderSettings_BillingSettingsQuery($selector: OrganizationSelectorInput!) {
    organization(selector: $selector) {
      organization {
        id
        cleanId
        billingConfiguration {
          provider
          taxId
          legalName
          billingEmail
          paymentMethod {
            methodType
            brand
            identifier
          }
        }
      }
    }
  }
`);

const paddleElementId = 'paddle-update-method-container';

function PaddleUpdatePaymentMethodContainer(props: {
  transactionId: string;
  onCheckoutCompleted: () => void;
}) {
  const paddle = usePaddle();

  React.useEffect(() => {
    paddle.instance.Update({
      eventCallback: data => {
        if (data.name === CheckoutEventNames.CHECKOUT_COMPLETED) {
          props.onCheckoutCompleted();
        }
      },
    });

    paddle.instance.Checkout.open({
      transactionId: props.transactionId,
      settings: {
        ...PADDLE_SETTINGS,
        frameTarget: paddleElementId,
        showAddTaxId: false,
        showAddDiscounts: false,
        allowLogout: false,
      },
    });

    return () => {
      paddle.instance.Checkout.close();
      paddle.instance.Update({
        eventCallback: undefined,
      });
    };
  }, [props.transactionId]);

  return <div className={paddleElementId} />;
}

function PaddleManagePaymentMethodButton(props: {
  organizationCleanId: string;
  onUpdateDone: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [mutation, mutate] = useMutation(PaddleGeneratePaymentMethodUpdateTokenMutation);
  const { toast } = useToast();

  const handleChangeFlow = async () => {
    await mutate({
      selector: {
        organization: props.organizationCleanId,
      },
    }).then(r => {
      if (r.data) {
        setIsOpen(true);
        setTransactionId(r.data.generatePaymentMethodUpdateToken);
      }
    });
  };

  const onCheckoutCompleted = () => {
    setIsOpen(false);
    setTransactionId(null);
    props.onUpdateDone();

    toast({
      title: 'Payment method updated successfully.',
    });
  };

  return (
    <>
      <Modal open={isOpen} onOpenChange={() => setIsOpen(false)} size="lg">
        <Heading>Update Payment Method</Heading>
        {transactionId ? (
          <PaddleUpdatePaymentMethodContainer
            transactionId={transactionId}
            onCheckoutCompleted={onCheckoutCompleted}
          />
        ) : null}
      </Modal>
      <Button
        onClick={handleChangeFlow}
        variant="primary"
        size="small"
        disabled={mutation.fetching}
      >
        {mutation.fetching ? 'loading...' : 'change'}
      </Button>
    </>
  );
}

function PaddleProviderSettings(props: { organizationCleanId: string }) {
  const { toast } = useToast();
  const [_, mutate] = useMutation(PaddleProviderSettings_UpdateBillingSettingsMutation);
  const [query, refetch] = useQuery({
    query: PaddleProviderSettings_BillingSettingsQuery,
    variables: {
      selector: {
        organization: props.organizationCleanId,
      },
    },
  });
  const billingData = query.data?.organization?.organization.billingConfiguration;

  const { handleSubmit, values, handleChange, handleBlur, isSubmitting, errors, touched, dirty } =
    useFormik({
      enableReinitialize: true,
      initialValues: {
        taxId: billingData?.taxId || '',
        companyName: billingData?.legalName || '',
        billingEmail: billingData?.billingEmail || '',
      },
      validationSchema: Yup.object().shape({
        taxId: Yup.string().max(40),
        companyName: Yup.string().max(255),
        billingEmail: Yup.string().email(),
      }),
      onSubmit: async values => {
        await mutate({
          input: {
            selector: {
              organization: props.organizationCleanId,
            },
            billingEmail: values.billingEmail,
            legalName: values.companyName,
            taxId: values.taxId,
          },
        })
          .then(() => {
            toast({
              title: 'Billing details updated successfully.',
              description: 'Your next invoice will reflect the changes.',
            });
          })
          .catch(() => {
            toast({
              variant: 'destructive',
              title: 'Failed to update billing details.',
              description: 'If the issue persists, please contact support',
            });
          });
      },
    });

  if (query.fetching || !query.data) {
    return <Spinner />;
  }

  if (!billingData) {
    return null;
  }

  return (
    <div className="w-1/2">
      <form onSubmit={handleSubmit}>
        <Table>
          <TBody>
            {billingData.paymentMethod ? (
              <Tr>
                <Td>Payment Method</Td>
                <Td>
                  {billingData.paymentMethod.methodType === 'card'
                    ? `Card (${billingData.paymentMethod.brand}, ${billingData.paymentMethod.identifier})`
                    : billingData.paymentMethod.methodType}
                </Td>
                <Td align="right">
                  <PaddleManagePaymentMethodButton
                    organizationCleanId={props.organizationCleanId}
                    onUpdateDone={refetch}
                  />
                </Td>
              </Tr>
            ) : null}
            <Tr>
              <Td>Company Name</Td>
              <Td colSpan={2}>
                <Input
                  name="companyName"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values.companyName}
                  disabled={isSubmitting}
                  size="small"
                  maxLength={255}
                  isInvalid={touched.companyName && !!errors.companyName}
                />
              </Td>
            </Tr>
            <Tr>
              <Td>Tax ID</Td>
              <Td colSpan={2}>
                <Input
                  name="taxId"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values.taxId}
                  disabled={isSubmitting}
                  size="small"
                  maxLength={40}
                  isInvalid={touched.taxId && !!errors.taxId}
                />
              </Td>
            </Tr>
            <Tr>
              <Td>Billing Email</Td>
              <Td colSpan={2}>
                <Input
                  name="billingEmail"
                  onChange={handleChange}
                  onBlur={handleBlur}
                  value={values.billingEmail}
                  disabled={isSubmitting}
                  size="small"
                  type="email"
                  isInvalid={touched.billingEmail && !!errors.billingEmail}
                />
              </Td>
            </Tr>
          </TBody>
        </Table>
        <Button type="submit" variant="primary" disabled={isSubmitting || !dirty}>
          Update Settings
        </Button>
      </form>
    </div>
  );
}

function StripeProviderSettings(props: { organizationCleanId: string }) {
  const [mutation, mutate] = useMutation(GenerateManagementLinkMutation);
  const router = useRouter();

  return (
    <div>
      To manage or change your payment method, billing settings, billing email, Tax ID, you can use
      the Stripe customer dashboard:
      <br />
      <Button
        variant="primary"
        onClick={() => {
          void mutate({
            selector: {
              organization: props.organizationCleanId,
            },
          }).then(result => {
            if (result.data?.generateSubscriptionManagementLink) {
              void router.push(result.data.generateSubscriptionManagementLink);
            }
          });
        }}
      >
        {mutation.fetching ? (
          'Loading...'
        ) : (
          <div className="flex items-center">
            <ExternalLinkIcon className="mr-1" /> Billing Dashboard
          </div>
        )}
      </Button>
    </div>
  );
}

export const BillingSettings = (props: {
  organization: FragmentType<typeof BillingPaymentMethod_OrganizationFragment>;
}) => {
  const organization = useFragment(BillingPaymentMethod_OrganizationFragment, props.organization);

  console.log(organization.billingConfiguration.provider);

  switch (organization.billingConfiguration.provider) {
    case 'STRIPE': {
      return <StripeProviderSettings organizationCleanId={organization.cleanId} />;
    }

    case 'PADDLE': {
      return <PaddleProviderSettings organizationCleanId={organization.cleanId} />;
    }

    default: {
      return (
        <div>
          Your subscription is managed externally. Please reach out to{' '}
          <Link variant="primary" href={`/${organization.cleanId}/view/support`}>
            contact support
          </Link>{' '}
          to make changes.
        </div>
      );
    }
  }
};
