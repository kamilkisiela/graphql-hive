import type { StripeTypes } from '@hive/stripe-billing';

export type BillingPaymentMethodMapper = StripeTypes.PaymentMethod.Card;
export type BillingDetailsMapper = StripeTypes.PaymentMethod.BillingDetails;
export type BillingInvoiceMapper = StripeTypes.Invoice | StripeTypes.UpcomingInvoice;
