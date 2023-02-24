import { ReactElement } from 'react';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
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
import { DataWrapper, noSchema, Title } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';
import { withSessionProtection } from '@/lib/supertokens/guard';

const SchemaTypeExplorer_Type = graphql(`
  query SchemaTypeExplorer_Type(
    $organization: ID!
    $project: ID!
    $target: ID!
    $period: DateRangeInput!
    $typename: String!
  ) {
    target(selector: { organization: $organization, project: $project, target: $target }) {
      __typename
      id
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
      selector: { organization: $organization, project: $project, target: $target, period: $period }
    ) {
      totalRequests
    }
  }
`);

const TypeRenderFragment = graphql(`
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

function TypeRenderer(props: {
  type: FragmentType<typeof TypeRenderFragment>;
  totalRequests: number;
}) {
  const ttype = useFragment(TypeRenderFragment, props.type);
  switch (ttype.__typename) {
    case 'GraphQLObjectType':
      return <GraphQLObjectTypeComponent type={ttype} totalRequests={props.totalRequests} />;
    case 'GraphQLInterfaceType':
      return <GraphQLInterfaceTypeComponent type={ttype} totalRequests={props.totalRequests} />;
    case 'GraphQLUnionType':
      return <GraphQLUnionTypeComponent type={ttype} totalRequests={props.totalRequests} />;
    case 'GraphQLEnumType':
      return <GraphQLEnumTypeComponent type={ttype} totalRequests={props.totalRequests} />;
    case 'GraphQLInputObjectType':
      return <GraphQLInputObjectTypeComponent type={ttype} totalRequests={props.totalRequests} />;
    case 'GraphQLScalarType':
      return <GraphQLScalarTypeComponent type={ttype} totalRequests={props.totalRequests} />;
    default:
      return <div>Unknown type: {(ttype as any).__typename}</div>;
  }
}

function SchemaTypeExplorer({
  organizationCleanId,
  projectCleanId,
  targetCleanId,
  typename,
}: {
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
  typename: string;
}): ReactElement | null {
  const { period } = useSchemaExplorerContext();
  const [query] = useQuery({
    query: SchemaTypeExplorer_Type,
    variables: {
      organization: organizationCleanId,
      project: projectCleanId,
      target: targetCleanId,
      period,
      typename,
    },
    requestPolicy: 'cache-first',
  });

  return (
    <DataWrapper query={query}>
      {({ data }) => {
        if (!data.target?.latestSchemaVersion) {
          return noSchema;
        }

        const { type } = data.target.latestSchemaVersion.explorer;
        const { totalRequests } = data.operationsStats;

        if (!type) {
          return <div>No type found</div>;
        }

        return (
          <div className="space-y-4">
            <SchemaExplorerFilter
              organization={{ cleanId: organizationCleanId }}
              project={{ cleanId: projectCleanId }}
              target={{ cleanId: targetCleanId }}
              period={period}
              typename={typename}
            />
            <TypeRenderer totalRequests={totalRequests} type={type} />
          </div>
        );
      }}
    </DataWrapper>
  );
}

const TargetExplorerTypenamePageQuery = graphql(`
  query TargetExplorerTypenamePageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_OrganizationFragment
        cleanId
        rateLimit {
          retentionInDays
        }
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
  }
`);

function ExplorerPage(): ReactElement | null {
  const router = useRouteSelector();
  const { typename } = router.query;

  if (typeof typename !== 'string') {
    return null;
  }

  return (
    <>
      <Title title={`Type ${typename}`} />
      <TargetLayout value="explorer" query={TargetExplorerTypenamePageQuery}>
        {props => (
          <SchemaExplorerProvider
            dataRetentionInDays={props.organization?.organization.rateLimit.retentionInDays ?? 0}
          >
            <SchemaTypeExplorer
              organizationCleanId={props.organization?.organization.cleanId ?? ''}
              projectCleanId={props.project?.cleanId ?? ''}
              targetCleanId={props.target?.cleanId ?? ''}
              typename={typename}
            />
          </SchemaExplorerProvider>
        )}
      </TargetLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(ExplorerPage);
