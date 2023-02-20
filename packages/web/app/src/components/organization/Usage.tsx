import React from 'react';
import { useQuery } from 'urql';
import {
  OrganizationFieldsFragment,
  OrgBillingInfoFieldsFragment,
  UsageEstimationDocument,
} from '@/graphql';
import { Table, TableContainer, Tbody, Td, Th, Thead, Tr } from '@chakra-ui/react';
import { Scale } from '../common';
import { DataWrapper } from '../common/DataWrapper';
import { calculatePeriod } from '../common/TimeFilter';

const NumericFormatter = Intl.NumberFormat('en', {
  notation: 'standard',
});

export const OrganizationUsageEstimationView: React.FC<{
  organization: OrganizationFieldsFragment & OrgBillingInfoFieldsFragment;
}> = ({ organization }) => {
  const period = calculatePeriod('month');

  const [query] = useQuery({
    query: UsageEstimationDocument,
    variables: {
      organization: organization.cleanId,
      range: period,
    },
  });

  return (
    <>
      <div className="top-7 right-4">
        <DataWrapper query={query}>
          {result => (
            <TableContainer>
              <Table size="sm">
                <Thead>
                  <Tr>
                    <Th>Feature</Th>
                    <Th isNumeric>Used</Th>
                    <Th isNumeric>Limit</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  <Tr>
                    <Td>Operations</Td>
                    <Td isNumeric>
                      {NumericFormatter.format(result.data.usageEstimation.org.operations)}
                    </Td>
                    <Td isNumeric>{NumericFormatter.format(organization.rateLimit.operations)}</Td>
                    <Td isNumeric>
                      <Scale
                        value={result.data.usageEstimation.org.operations}
                        size={10}
                        max={organization.rateLimit.operations}
                        className="justify-end"
                      />
                    </Td>
                  </Tr>
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </DataWrapper>
      </div>
    </>
  );
};
