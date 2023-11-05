import { ReactElement } from 'react';
import { useQuery } from 'urql';
import { DataWrapper, Table, TBody, Td, Th, THead, Tr } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { Scale } from '../common';
import { calculatePeriod } from '../common/TimeFilter';

const NumericFormatter = Intl.NumberFormat('en', { notation: 'standard' });

const OrganizationUsageEstimationView_OrganizationFragment = graphql(`
  fragment OrganizationUsageEstimationView_OrganizationFragment on Organization {
    cleanId
    rateLimit {
      operations
    }
  }
`);

const Usage_UsageEstimationQuery = graphql(`
  query Usage_UsageEstimationQuery($range: DateRangeInput!, $organization: ID!) {
    usageEstimation(range: $range) {
      org(selector: { organization: $organization }) {
        operations
      }
    }
  }
`);

export function OrganizationUsageEstimationView(props: {
  organization: FragmentType<typeof OrganizationUsageEstimationView_OrganizationFragment>;
}): ReactElement {
  const organization = useFragment(
    OrganizationUsageEstimationView_OrganizationFragment,
    props.organization,
  );
  const period = calculatePeriod('month');

  const [query] = useQuery({
    query: Usage_UsageEstimationQuery,
    variables: {
      organization: organization.cleanId,
      range: period,
    },
  });

  return (
    <div className="right-4 top-7">
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
