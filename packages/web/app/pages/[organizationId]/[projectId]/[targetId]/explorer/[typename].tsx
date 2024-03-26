import { useEffect } from 'react';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Page, TargetLayout } from '@/components/layouts/target';
import { GraphQLEnumTypeComponent } from '@/components/target/explorer/enum-type';
import { SchemaExplorerFilter } from '@/components/target/explorer/filter';
import { GraphQLInputObjectTypeComponent } from '@/components/target/explorer/input-object-type';
import { GraphQLInterfaceTypeComponent } from '@/components/target/explorer/interface-type';
import { GraphQLObjectTypeComponent } from '@/components/target/explorer/object-type';
import {
  SchemaExplorerProvider,
  useSchemaExplorerContext,
} from '@/components/target/explorer/provider';
import { GraphQLScalarTypeComponent } from '@/components/target/explorer/scalar-type';
import { GraphQLUnionTypeComponent } from '@/components/target/explorer/union-type';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { MetaTitle } from '@/components/v2';
import { noSchemaVersion } from '@/components/v2/empty-list';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

export const TypeRenderFragment = graphql(`
  fragment TypeRenderFragment on GraphQLNamedType {
    __typename
    ...GraphQLObjectTypeComponent_TypeFragment
    ...GraphQLInterfaceTypeComponent_TypeFragment
    ...GraphQLUnionTypeComponent_TypeFragment
    ...GraphQLEnumTypeComponent_TypeFragment
    ...GraphQLInputObjectTypeComponent_TypeFragment
    ...GraphQLScalarTypeComponent_TypeFragment
  }
`);

export function TypeRenderer(props: {
  type: FragmentType<typeof TypeRenderFragment>;
  totalRequests?: number;
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
}) {
  const ttype = useFragment(TypeRenderFragment, props.type);
  switch (ttype.__typename) {
    case 'GraphQLObjectType':
      return (
        <GraphQLObjectTypeComponent
          type={ttype}
          totalRequests={props.totalRequests}
          targetCleanId={props.targetCleanId}
          projectCleanId={props.projectCleanId}
          organizationCleanId={props.organizationCleanId}
        />
      );
    case 'GraphQLInterfaceType':
      return (
        <GraphQLInterfaceTypeComponent
          type={ttype}
          totalRequests={props.totalRequests}
          targetCleanId={props.targetCleanId}
          projectCleanId={props.projectCleanId}
          organizationCleanId={props.organizationCleanId}
        />
      );
    case 'GraphQLUnionType':
      return (
        <GraphQLUnionTypeComponent
          type={ttype}
          totalRequests={props.totalRequests}
          targetCleanId={props.targetCleanId}
          projectCleanId={props.projectCleanId}
          organizationCleanId={props.organizationCleanId}
        />
      );
    case 'GraphQLEnumType':
      return (
        <GraphQLEnumTypeComponent
          type={ttype}
          totalRequests={props.totalRequests}
          targetCleanId={props.targetCleanId}
          projectCleanId={props.projectCleanId}
          organizationCleanId={props.organizationCleanId}
        />
      );
    case 'GraphQLInputObjectType':
      return (
        <GraphQLInputObjectTypeComponent
          type={ttype}
          totalRequests={props.totalRequests}
          targetCleanId={props.targetCleanId}
          projectCleanId={props.projectCleanId}
          organizationCleanId={props.organizationCleanId}
        />
      );
    case 'GraphQLScalarType':
      return (
        <GraphQLScalarTypeComponent
          type={ttype}
          totalRequests={props.totalRequests}
          targetCleanId={props.targetCleanId}
          projectCleanId={props.projectCleanId}
          organizationCleanId={props.organizationCleanId}
        />
      );
    default:
      return <div>Unknown type: {(ttype as any).__typename}</div>;
  }
}

const TargetExplorerTypenamePageQuery = graphql(`
  query TargetExplorerTypenamePageQuery(
    $organizationId: ID!
    $projectId: ID!
    $targetId: ID!
    $period: DateRangeInput!
    $typename: String!
  ) {
    organizations {
      ...TargetLayout_OrganizationConnectionFragment
    }
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_CurrentOrganizationFragment
        cleanId
        rateLimit {
          retentionInDays
        }
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
          type(name: $typename) {
            ...TypeRenderFragment
          }
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

function TypeExplorerPageContent({ typename }: { typename: string }) {
  const router = useRouteSelector();
  const { resolvedPeriod, dataRetentionInDays, setDataRetentionInDays } =
    useSchemaExplorerContext();
  const [query] = useQuery({
    query: TargetExplorerTypenamePageQuery,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
      targetId: router.targetId,
      period: resolvedPeriod,
      typename,
    },
  });

  const currentOrganization = query.data?.organization?.organization;
  const retentionInDays = currentOrganization?.rateLimit.retentionInDays;

  useEffect(() => {
    if (typeof retentionInDays === 'number' && dataRetentionInDays !== retentionInDays) {
      setDataRetentionInDays(retentionInDays);
    }
  }, [setDataRetentionInDays, retentionInDays]);

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  const me = query.data?.me;
  const currentProject = query.data?.project;
  const currentTarget = query.data?.target;
  const organizationConnection = query.data?.organizations;
  const isCDNEnabled = query.data;
  const type = currentTarget?.latestSchemaVersion?.explorer?.type;
  const latestSchemaVersion = currentTarget?.latestSchemaVersion;

  return (
    <TargetLayout
      page={Page.Explorer}
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      me={me ?? null}
      organizations={organizationConnection ?? null}
      isCDNEnabled={isCDNEnabled ?? null}
    >
      <div className="flex flex-row items-center justify-between py-6">
        <div>
          <Title>Explore</Title>
          <Subtitle>Insights from the latest version.</Subtitle>
        </div>
        {latestSchemaVersion && type ? (
          <SchemaExplorerFilter
            organization={{ cleanId: router.organizationId }}
            project={{ cleanId: router.projectId }}
            target={{ cleanId: router.targetId }}
            period={resolvedPeriod}
          />
        ) : null}
      </div>
      {query.fetching ? null : latestSchemaVersion && type ? (
        <TypeRenderer
          totalRequests={query.data?.operationsStats.totalRequests ?? 0}
          type={type}
          organizationCleanId={router.organizationId}
          projectCleanId={router.projectId}
          targetCleanId={router.targetId}
        />
      ) : type ? (
        noSchemaVersion
      ) : (
        <div>Not found</div>
      )}
    </TargetLayout>
  );
}

function TypeExplorerPage() {
  const router = useRouteSelector();
  const { typename } = router.query;

  if (typeof typename !== 'string') {
    return null;
  }

  return (
    <>
      <MetaTitle title={`Type ${typename}`} />
      <SchemaExplorerProvider>
        <TypeExplorerPageContent typename={typename} />
      </SchemaExplorerProvider>
    </>
  );
}

export default authenticated(TypeExplorerPage);
