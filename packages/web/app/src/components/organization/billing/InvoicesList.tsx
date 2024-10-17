import { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { CurrencyFormatter, DateFormatter } from './helpers';

const OrganizationInvoicesList_OrganizationFragment = graphql(`
  fragment OrganizationInvoicesList_OrganizationFragment on Organization {
    id
    slug
    billingConfiguration {
      hasPaymentIssues
      invoices {
        id
        date
        amount
        periodStart
        periodEnd
        pdfLink
        status
      }
    }
  }
`);

export function InvoicesList(props: {
  organization: FragmentType<typeof OrganizationInvoicesList_OrganizationFragment>;
}): ReactElement | null {
  const organization = useFragment(
    OrganizationInvoicesList_OrganizationFragment,
    props.organization,
  );
  if (!organization.billingConfiguration?.invoices?.length) {
    return null;
  }

  return (
    <Table>
      <THead>
        <Th>Invoice Date</Th>
        <Th>Amount</Th>
        <Th>Status</Th>
        <Th>Period Start</Th>
        <Th>Period End</Th>
        <Th>PDF</Th>
      </THead>
      <TBody>
        {organization.billingConfiguration.invoices.map(invoice => (
          <Tr key={invoice.id}>
            <Td>{DateFormatter.format(new Date(invoice.date))}</Td>
            <Td>{CurrencyFormatter.format(invoice.amount)}</Td>
            <Td>{invoice.status}</Td>
            <Td>{DateFormatter.format(new Date(invoice.periodStart))}</Td>
            <Td>{DateFormatter.format(new Date(invoice.periodEnd))}</Td>
            <Td>
              {invoice.pdfLink && (
                <Button variant="orangeLink" asChild>
                  <a href={invoice.pdfLink} target="_blank" rel="noreferrer">
                    Download
                  </a>
                </Button>
              )}
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
