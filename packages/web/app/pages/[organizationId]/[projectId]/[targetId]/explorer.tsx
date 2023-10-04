import { ReactElement } from 'react';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Page, TargetLayout } from '@/components/layouts/target';
import { SchemaExplorerFilter } from '@/components/target/explorer/filter';
import { GraphQLObjectTypeComponent } from '@/components/target/explorer/object-type';
import {
  SchemaExplorerProvider,
  useSchemaExplorerContext,
} from '@/components/target/explorer/provider';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { MetaTitle } from '@/components/v2';
import { noSchemaVersion } from '@/components/v2/empty-list';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useRouteSelector } from '@/lib/hooks';
import { withSessionProtection } from '@/lib/supertokens/guard';

const ExplorerPage_SchemaExplorerFragment = graphql(`
  fragment ExplorerPage_SchemaExplorerFragment on SchemaExplorer {
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
`);

function SchemaView(props: {
  explorer: FragmentType<typeof ExplorerPage_SchemaExplorerFragment>;
  totalRequests: number;
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
}) {
  const { query, mutation, subscription } = useFragment(
    ExplorerPage_SchemaExplorerFragment,
    props.explorer,
  );
  const { totalRequests } = props;

  return (
    <div className="flex flex-col gap-4">
      {query ? (
        <GraphQLObjectTypeComponent
          type={query}
          totalRequests={totalRequests}
          collapsed
          targetCleanId={props.targetCleanId}
          projectCleanId={props.projectCleanId}
          organizationCleanId={props.organizationCleanId}
        />
      ) : null}
      {mutation ? (
        <GraphQLObjectTypeComponent
          type={mutation}
          totalRequests={totalRequests}
          collapsed
          targetCleanId={props.targetCleanId}
          projectCleanId={props.projectCleanId}
          organizationCleanId={props.organizationCleanId}
        />
      ) : null}
      {subscription ? (
        <GraphQLObjectTypeComponent
          type={subscription}
          totalRequests={totalRequests}
          collapsed
          targetCleanId={props.targetCleanId}
          projectCleanId={props.projectCleanId}
          organizationCleanId={props.organizationCleanId}
        />
      ) : null}
    </div>
  );
}

const TargetExplorerPageQuery = graphql(`
  query TargetExplorerPageQuery(
    $organizationId: ID!
    $projectId: ID!
    $targetId: ID!
    $period: DateRangeInput!
  ) {
    organizations {
      ...TargetLayout_OrganizationConnectionFragment
    }
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_CurrentOrganizationFragment
        rateLimit {
          retentionInDays
        }
        cleanId
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_CurrentProjectFragment
      cleanId
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
      cleanId
      latestSchemaVersion {
        __typename
        id
        valid
        explorer(usage: { period: $period }) {
          ...ExplorerPage_SchemaExplorerFragment
        }
      }
    }
    operationsStats(
      selector: {
        organization: $organizationId
        project: $projectId
        target: $targetId
        period: $period
      }
    ) {
      totalRequests
    }
    me {
      ...TargetLayout_MeFragment
    }
    ...TargetLayout_IsCDNEnabledFragment
  }
`);

function ExplorerPageContent() {
  const router = useRouteSelector();
  const { period, dataRetentionInDays, setDataRetentionInDays } = useSchemaExplorerContext();
  const [query] = useQuery({
    query: TargetExplorerPageQuery,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
      targetId: router.targetId,
      period,
    },
  });

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const currentProject = query.data?.project;
  const currentTarget = query.data?.target;
  const organizationConnection = query.data?.organizations;
  const isCDNEnabled = query.data;
  const explorer = currentTarget?.latestSchemaVersion?.explorer;
  const latestSchemaVersion = currentTarget?.latestSchemaVersion;

  const retentionInDays = currentOrganization?.rateLimit.retentionInDays;
  if (typeof retentionInDays === 'number' && dataRetentionInDays !== retentionInDays) {
    setDataRetentionInDays(retentionInDays);
  }

  return (
    <TargetLayout
      page={Page.Explorer}
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      me={me ?? null}
      organizations={organizationConnection ?? null}
      isCDNEnabled={isCDNEnabled ?? null}
    >
      <div className="py-6 flex flex-row items-center justify-between">
        <div>
          <Title>Explore</Title>
          <Subtitle>Insights from the latest version.</Subtitle>
        </div>
        {latestSchemaVersion ? (
          <SchemaExplorerFilter
            organization={{ cleanId: router.organizationId }}
            project={{ cleanId: router.projectId }}
            target={{ cleanId: router.targetId }}
            period={period}
          />
        ) : null}
      </div>
      {query.fetching ? null : latestSchemaVersion && explorer ? (
        <SchemaView
          totalRequests={query.data?.operationsStats.totalRequests ?? 0}
          explorer={explorer}
          organizationCleanId={router.organizationId}
          projectCleanId={router.projectId}
          targetCleanId={router.targetId}
        />
      ) : (
        noSchemaVersion
      )}
    </TargetLayout>
  );
}

function ExplorerPage(): ReactElement {
  return (
    <>
      <MetaTitle title="Schema Explorer" />
      <SchemaExplorerProvider>
        <ExplorerPageContent />
      </SchemaExplorerProvider>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(ExplorerPage);
