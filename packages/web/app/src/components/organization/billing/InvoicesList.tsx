import { OrganizationFieldsFragment, OrgBillingInfoFieldsFragment } from '@/graphql';
import { Table, TableContainer, Tbody, Td, Th, Thead, Tr, Link } from '@chakra-ui/react';
import React from 'react';
import { VscCloudDownload } from 'react-icons/vsc';
import { CurrencyFormatter } from './helpers';

export const InvoicesList: React.FC<{
  organization: OrganizationFieldsFragment & OrgBillingInfoFieldsFragment;
}> = ({ organization }) => {
  if (null == organization.billingConfiguration?.invoices?.length) {
    return null;
  }

  return (
    <TableContainer>
      <Table size="sm">
        <Thead>
          <Tr>
            <Th>Invoice Date</Th>
            <Th>Amount</Th>
            <Th>Period Start</Th>
            <Th>Period End</Th>
            <Th>PDF</Th>
          </Tr>
        </Thead>
        <Tbody>
          {organization.billingConfiguration.invoices.map(invoice => (
            <Tr>
              <Td>{invoice.date}</Td>
              <Td>{CurrencyFormatter.format(invoice.amount)}</Td>
              <Td>{invoice.periodStart}</Td>
              <Td>{invoice.periodEnd}</Td>
              <Td>
                {invoice.pdfLink ? (
                  <Link href={invoice.pdfLink}>
                    <VscCloudDownload />
                  </Link>
                ) : null}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableContainer>
  );
};
