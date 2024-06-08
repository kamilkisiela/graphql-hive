import { BillingInvoiceStatus } from '../../../__generated__/types';

type Cents = number;

export type BillingPrices = {
  basePrice: { identifier: string; amount: Cents };
  pricePerMillionOperations: { identifier: string; amount: Cents };
};

export type FuturePayment = {
  date: Date;
  amount: Cents;
};

export type BillingInvoice = {
  id: string | null;
  amount: Cents;
  date: Date;
  periodStart: Date;
  periodEnd: Date;
  pdfUrl: string | null;
  status: BillingInvoiceStatus;
};

export type Subscription = {
  id: string;
  trialEnd: number | null;
};

export type BillingInfo = {
  taxId: string | null;
  legalName: string | null;
  billingEmail: string | null;
  paymentMethod: null | {
    type: string;
    brand: string | null;
    last4: string | null;
  };
};

export type BillingInfoUpdateInput = Omit<BillingInfo, 'paymentMethod'>;

export interface BillingDataProvider {
  getAvailablePrices(): Promise<BillingPrices>;
  invoices(customerId: string, organizationId: string): Promise<BillingInvoice[]>;
  upcomingPayment(customerId: string, organizationId: string): Promise<FuturePayment | null>;
  getActiveSubscription(customerId: string, organizationId: string): Promise<Subscription | null>;
  hasPaymentIssues(customerId: string, organizationId: string): Promise<boolean>;
  subscriptionManagementUrl(customerId: string, organizationId: string): Promise<string | null>;
  syncOperationsLimit(
    customerId: string,
    organizationId: string,
    operationsInMillions: number,
  ): Promise<void>;
  cancelActiveSubscription(customerId: string, organizationId: string): Promise<void>;
  billingInfo(customerId: string, organizationId: string): Promise<BillingInfo>;
}
