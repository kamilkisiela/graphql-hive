import { ReactElement } from 'react';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { SchemaExplorerFilter } from '@/components/target/explorer/filter';
import { GraphQLObjectTypeComponent } from '@/components/target/explorer/object-type';
import {
  SchemaExplorerProvider,
  useSchemaExplorerContext,
} from '@/components/target/explorer/provider';
import { DataWrapper, noSchema, Title } from '@/components/v2';
import { graphql } from '@/gql';
import { withSessionProtection } from '@/lib/supertokens/guard';

const SchemaView_SchemaExplorer = graphql(`
  query SchemaView_SchemaExplorer(
    $organization: ID!
    $project: ID!
    $target: ID!
    $period: DateRangeInput!
  ) {
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
    operationsStats(
      selector: { organization: $organization, project: $project, target: $target, period: $period }
    ) {
      totalRequests
    }
  }
`);

function SchemaView({
  organizationCleanId,
  projectCleanId,
  targetCleanId,
}: {
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
}): ReactElement | null {
  const { period } = useSchemaExplorerContext();
  const [query] = useQuery({
    query: SchemaView_SchemaExplorer,
    variables: {
      organization: organizationCleanId,
      project: projectCleanId,
      target: targetCleanId,
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
              <SchemaExplorerFilter
                organization={{ cleanId: organizationCleanId }}
                project={{ cleanId: projectCleanId }}
                target={{ cleanId: targetCleanId }}
                period={period}
              />
              {query ? (
                <GraphQLObjectTypeComponent type={query} totalRequests={totalRequests} collapsed />
              ) : null}
              {mutation ? (
                <GraphQLObjectTypeComponent
                  type={mutation}
                  totalRequests={totalRequests}
                  collapsed
                />
              ) : null}
              {subscription ? (
                <GraphQLObjectTypeComponent
                  type={subscription}
                  totalRequests={totalRequests}
                  collapsed
                />
              ) : null}
            </div>
          </>
        );
      }}
    </DataWrapper>
  );
}

const TargetExplorerPageQuery = graphql(`
  query TargetExplorerPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_OrganizationFragment
        rateLimit {
          retentionInDays
        }
        cleanId
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_ProjectFragment
      cleanId
    }
    targets(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_TargetConnectionFragment
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      cleanId
    }
    ...TargetLayout_IsCDNEnabledFragment
  }
`);

function ExplorerPage(): ReactElement {
  return (
    <>
      <Title title="Schema Explorer" />
      <TargetLayout value="explorer" query={TargetExplorerPageQuery}>
        {props =>
          props.organization && props.project && props.target ? (
            <SchemaExplorerProvider
              dataRetentionInDays={props.organization.organization.rateLimit.retentionInDays}
            >
              <SchemaView
                organizationCleanId={props.organization.organization.cleanId}
                projectCleanId={props.project.cleanId}
                targetCleanId={props.target.cleanId}
              />
            </SchemaExplorerProvider>
          ) : null
        }
      </TargetLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(ExplorerPage);
