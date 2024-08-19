import type {
  BillingInvoiceResolvers,
  BillingInvoiceStatus,
} from './../../../__generated__/types.next';

export const BillingInvoice: BillingInvoiceResolvers = {
  id: i => (i && 'id' in i ? i.id : 'upcoming'),
  amount: i => parseFloat((i.total / 100).toFixed(2)),
  pdfLink: i => i.invoice_pdf || null,
  date: i => new Date(i.created * 1000).toISOString(),
  periodStart: i => new Date(i.period_start * 1000).toISOString(),
  periodEnd: i => new Date(i.period_end * 1000).toISOString(),
  status: i => (i.status ? (i.status.toUpperCase() as BillingInvoiceStatus) : 'DRAFT'),
};
