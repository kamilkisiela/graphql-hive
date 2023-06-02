import { ReactElement } from 'react';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts/target';
import { SchemaExplorerFilter } from '@/components/target/explorer/filter';
import { GraphQLObjectTypeComponent } from '@/components/target/explorer/object-type';
import {
  SchemaExplorerProvider,
  useSchemaExplorerContext,
} from '@/components/target/explorer/provider';
import { Title } from '@/components/v2';
import { noSchemaVersion } from '@/components/v2/empty-list';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useRouteSelector } from '@/lib/hooks';
import { useNotFoundRedirectOnError } from '@/lib/hooks/use-not-found-redirect-on-error';
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
}) {
  const { query, mutation, subscription } = useFragment(
    ExplorerPage_SchemaExplorerFragment,
    props.explorer,
  );
  const { totalRequests } = props;

  return (
    <div className="flex flex-col gap-4">
      {query ? (
        <GraphQLObjectTypeComponent type={query} totalRequests={totalRequests} collapsed />
      ) : null}
      {mutation ? (
        <GraphQLObjectTypeComponent type={mutation} totalRequests={totalRequests} collapsed />
      ) : null}
      {subscription ? (
        <GraphQLObjectTypeComponent type={subscription} totalRequests={totalRequests} collapsed />
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
  useNotFoundRedirectOnError(!!query.error);

  if (query.error) {
    return null;
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
      value="explorer"
      className="flex justify-between gap-8"
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      me={me ?? null}
      organizations={organizationConnection ?? null}
      isCDNEnabled={isCDNEnabled ?? null}
    >
      <div className="grow">
        <div className="py-6 flex flex-row items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Explore</h3>
            <p className="text-sm text-gray-400">Insights from the latest version.</p>
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
        {latestSchemaVersion && explorer ? (
          <SchemaView
            totalRequests={query.data?.operationsStats.totalRequests ?? 0}
            explorer={explorer}
          />
        ) : (
          noSchemaVersion
        )}
      </div>
    </TargetLayout>
  );
}

function ExplorerPage(): ReactElement {
  return (
    <>
      <Title title="Schema Explorer" />
      <SchemaExplorerProvider>
        <ExplorerPageContent />
      </SchemaExplorerProvider>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(ExplorerPage);
