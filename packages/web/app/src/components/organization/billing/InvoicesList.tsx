import { ReactElement } from 'react';
import { Link, Table, TBody, Td, Th, THead, Tr } from '@/components/v2';
import { OrganizationFieldsFragment, OrgBillingInfoFieldsFragment } from '@/graphql';
import { CurrencyFormatter, DateFormatter } from './helpers';

export function InvoicesList({
  organization,
}: {
  organization: OrganizationFieldsFragment & OrgBillingInfoFieldsFragment;
}): ReactElement | null {
  if (!organization.billingConfiguration?.invoices?.length) {
    return null;
  }

  return (
    <Table>
      <THead>
        <Th>Invoice Date</Th>
        <Th>Amount</Th>
        <Th>Period Start</Th>
        <Th>Period End</Th>
        <Th>PDF</Th>
      </THead>
      <TBody>
        {organization.billingConfiguration.invoices.map(invoice => (
          <Tr key={invoice.id}>
            <Td>{DateFormatter.format(new Date(invoice.date))}</Td>
            <Td>{CurrencyFormatter.format(invoice.amount)}</Td>
            <Td>{DateFormatter.format(new Date(invoice.periodStart))}</Td>
            <Td>{DateFormatter.format(new Date(invoice.periodEnd))}</Td>
            <Td>
              {invoice.pdfLink && (
                <Link variant="primary" href={invoice.pdfLink} target="_blank" rel="noreferrer">
                  Download
                </Link>
              )}
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
