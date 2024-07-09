import { ReactElement } from 'react';
import { useQuery } from 'urql';
import { DataWrapper, Table, TBody, Td, Th, THead, Tr } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { Scale } from '../common';

const NumericFormatter = Intl.NumberFormat('en', { notation: 'standard' });
const DateFormatter = Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const OrganizationUsageEstimationView_OrganizationFragment = graphql(`
  fragment OrganizationUsageEstimationView_OrganizationFragment on Organization {
    id
    cleanId
    rateLimit {
      operations
    }
  }
`);

const Usage_UsageEstimationQuery = graphql(`
  query Usage_UsageEstimationQuery($input: UsageEstimationInput!) {
    usageEstimation(input: $input) {
      operations
      periodStart
      periodEnd
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

  const [query] = useQuery({
    query: Usage_UsageEstimationQuery,
    variables: {
      input: {
        organization: organization.cleanId,
      },
    },
  });

  return (
    <div className="right-4 top-7">
      <DataWrapper query={query} organizationId={organization.cleanId}>
        {result => (
          <>
            <p className="text-sm text-gray-500">
              {DateFormatter.format(new Date(result.data.usageEstimation.periodStart))} —{' '}
              {DateFormatter.format(new Date(result.data.usageEstimation.periodEnd))}
            </p>
            <div className="mt-4">
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
                      {NumericFormatter.format(result.data.usageEstimation.operations)}
                    </Td>
                    <Td align="right">
                      {NumericFormatter.format(organization.rateLimit.operations)}
                    </Td>
                    <Td>
                      <Scale
                        value={result.data.usageEstimation.operations}
                        size={10}
                        max={organization.rateLimit.operations}
                        className="justify-end"
                      />
                    </Td>
                  </Tr>
                </TBody>
              </Table>
            </div>
          </>
        )}
      </DataWrapper>
    </div>
  );
}
