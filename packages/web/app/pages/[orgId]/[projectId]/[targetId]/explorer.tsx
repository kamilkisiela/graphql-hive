import { ReactElement } from 'react';
import { useQuery } from 'urql';

import { authenticated, withSessionProtection } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { SchemaExplorerFilter } from '@/components/target/explorer/filter';
import { GraphQLObjectTypeComponent } from '@/components/target/explorer/object-type';
import { SchemaExplorerProvider, useSchemaExplorerContext } from '@/components/target/explorer/provider';
import { DataWrapper, noSchema, Title } from '@/components/v2';
import { graphql } from '@/gql';
import { OrganizationFieldsFragment, ProjectFieldsFragment, TargetFieldsFragment } from '@/graphql';

const SchemaView_SchemaExplorer = graphql(/* GraphQL */ `
  query SchemaView_SchemaExplorer($organization: ID!, $project: ID!, $target: ID!, $period: DateRangeInput!) {
    target(selector: { organization: $organization, project: $project, target: $target }) {
      __typename
      id
      latestSchemaVersion {
        __typename
        id
        valid
        explorer(usage: { period: $period }) {
          query {
            ...GraphQLObjectTypeComponent_TypeFragment
          }
          mutation {
            ...GraphQLObjectTypeComponent_TypeFragment
          }
          subscription {
            ...GraphQLObjectTypeComponent_TypeFragment
          }
        }
      }
    }
    operationsStats(selector: { organization: $organization, project: $project, target: $target, period: $period }) {
      totalRequests
    }
  }
`);

function SchemaView({
  organization,
  project,
  target,
}: {
  organization: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
  target: TargetFieldsFragment;
}): ReactElement | null {
  const { period } = useSchemaExplorerContext();
  const [query] = useQuery({
    query: SchemaView_SchemaExplorer,
    variables: {
      organization: organization.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      period,
    },
    requestPolicy: 'cache-first',
  });

  return (
    <DataWrapper query={query}>
      {({ data }) => {
        if (!data.target?.latestSchemaVersion) {
          return noSchema;
        }

        const { query, mutation, subscription } = data.target.latestSchemaVersion.explorer;
        const { totalRequests } = data.operationsStats;

        return (
          <>
            <div className="mb-5 flex flex-row items-center justify-between">
              <div className="font-light text-gray-500">The latest published schema.</div>
            </div>
            <div className="flex flex-col gap-4">
              <SchemaExplorerFilter organization={organization} project={project} target={target} period={period} />
              {query ? <GraphQLObjectTypeComponent type={query} totalRequests={totalRequests} collapsed /> : null}
              {mutation ? <GraphQLObjectTypeComponent type={mutation} totalRequests={totalRequests} collapsed /> : null}
              {subscription ? (
                <GraphQLObjectTypeComponent type={subscription} totalRequests={totalRequests} collapsed />
              ) : null}
            </div>
          </>
        );
      }}
    </DataWrapper>
  );
}

function ExplorerPage(): ReactElement {
  return (
    <>
      <Title title="Schema Explorer" />
      <TargetLayout value="explorer">
        {props => (
          <SchemaExplorerProvider dataRetentionInDays={props.organization.rateLimit.retentionInDays}>
            <SchemaView {...props} />
          </SchemaExplorerProvider>
        )}
      </TargetLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(ExplorerPage);
