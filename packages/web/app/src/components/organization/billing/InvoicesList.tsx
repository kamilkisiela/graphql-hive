import React from 'react';
import { Link, Table, TableContainer, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react';
import { VscCloudDownload } from 'react-icons/vsc';
import { OrganizationFieldsFragment, OrgBillingInfoFieldsFragment } from '@/graphql';
import { CurrencyFormatter, DateFormatter } from './helpers';

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
              <Td>{DateFormatter.format(new Date(invoice.date))}</Td>
              <Td>{CurrencyFormatter.format(invoice.amount)}</Td>
              <Td>{DateFormatter.format(new Date(invoice.periodStart))}</Td>
              <Td>{DateFormatter.format(new Date(invoice.periodEnd))}</Td>
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
