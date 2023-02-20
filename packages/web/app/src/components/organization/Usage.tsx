import { ReactElement } from 'react';
import { useQuery } from 'urql';
import { DataWrapper, Table, TBody, Td, Th, THead, Tr } from '@/components/v2';
import {
  OrganizationFieldsFragment,
  OrgBillingInfoFieldsFragment,
  UsageEstimationDocument,
} from '@/graphql';
import { Scale } from '../common';
import { calculatePeriod } from '../common/TimeFilter';

const NumericFormatter = Intl.NumberFormat('en', { notation: 'standard' });

export function OrganizationUsageEstimationView({
  organization,
}: {
  organization: OrganizationFieldsFragment & OrgBillingInfoFieldsFragment;
}): ReactElement {
  const period = calculatePeriod('month');

  const [query] = useQuery({
    query: UsageEstimationDocument,
    variables: {
      organization: organization.cleanId,
      range: period,
    },
  });

  return (
    <div className="top-7 right-4">
      <DataWrapper query={query}>
        {result => (
          <Table>
            <THead>
              <Th>Feature</Th>
              <Th align="right">Used</Th>
              <Th align="right">Limit</Th>
            </THead>
            <TBody>
              <Tr>
                <Td>Operations</Td>
                <Td align="right">
                  {NumericFormatter.format(result.data.usageEstimation.org.operations)}
                </Td>
                <Td align="right">{NumericFormatter.format(organization.rateLimit.operations)}</Td>
                <Td>
                  <Scale
                    value={result.data.usageEstimation.org.operations}
                    size={10}
                    max={organization.rateLimit.operations}
                    className="justify-end"
                  />
                </Td>
              </Tr>
            </TBody>
          </Table>
        )}
      </DataWrapper>
    </div>
  );
}
