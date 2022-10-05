import { ReactElement } from 'react';
import { useQuery } from 'urql';

import { authenticated, withSessionProtection } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import { GraphQLEnumTypeComponent } from '@/components/target/explorer/enum-type';
import { SchemaExplorerFilter } from '@/components/target/explorer/filter';
import { GraphQLInputObjectTypeComponent } from '@/components/target/explorer/input-object-type';
import { GraphQLInterfaceTypeComponent } from '@/components/target/explorer/interface-type';
import { GraphQLObjectTypeComponent } from '@/components/target/explorer/object-type';
import { SchemaExplorerProvider, useSchemaExplorerContext } from '@/components/target/explorer/provider';
import { GraphQLScalarTypeComponent } from '@/components/target/explorer/scalar-type';
import { GraphQLUnionTypeComponent } from '@/components/target/explorer/union-type';
import { DataWrapper, noSchema, Title } from '@/components/v2';
import { FragmentType, graphql, useFragment } from '@/gql';
import { OrganizationFieldsFragment, ProjectFieldsFragment, TargetFieldsFragment } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

const SchemaTypeExplorer_Type = graphql(/* GraphQL */ `
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
            __typename
            ...TypeRenderer_GraphQLNamedTypeFragment
          }
        }
      }
    }
    operationsStats(selector: { organization: $organization, project: $project, target: $target, period: $period }) {
      totalRequests
    }
  }
`);

const TypeRenderer_GraphQLNamedTypeFragment = graphql(/* GraphQL */ `
  fragment TypeRenderer_GraphQLNamedTypeFragment on GraphQLNamedType {
    __typename
    ...GraphQLEnumTypeComponent_TypeFragment
    ...GraphQLInputObjectTypeComponent_TypeFragment
    ...GraphQLInterfaceTypeComponent_TypeFragment
    ...GraphQLObjectTypeComponent_TypeFragment
    ...GraphQLScalarTypeComponent_TypeFragment
    ...GraphQLUnionTypeComponent_TypeFragment
  }
`);

function TypeRenderer(props: {
  type: FragmentType<typeof TypeRenderer_GraphQLNamedTypeFragment>;
  totalRequests: number;
}) {
  const type = useFragment(TypeRenderer_GraphQLNamedTypeFragment, props.type);
  switch (type.__typename) {
    case 'GraphQLObjectType':
      return <GraphQLObjectTypeComponent type={type} totalRequests={props.totalRequests} />;
    case 'GraphQLInterfaceType':
      return <GraphQLInterfaceTypeComponent type={type} totalRequests={props.totalRequests} />;
    case 'GraphQLUnionType':
      return <GraphQLUnionTypeComponent type={type} totalRequests={props.totalRequests} />;
    case 'GraphQLEnumType':
      return <GraphQLEnumTypeComponent type={type} totalRequests={props.totalRequests} />;
    case 'GraphQLInputObjectType':
      return <GraphQLInputObjectTypeComponent type={type} totalRequests={props.totalRequests} />;
    case 'GraphQLScalarType':
      return <GraphQLScalarTypeComponent type={type} totalRequests={props.totalRequests} />;
    default:
      // TODO: we need future proof stuff here (in Codegen)
      return <div>Unknown type: {(type as any).__typename}</div>;
  }
}

function SchemaTypeExplorer({
  organization,
  project,
  target,
  typename,
}: {
  organization: OrganizationFieldsFragment;
  project: ProjectFieldsFragment;
  target: TargetFieldsFragment;
  typename: string;
}): ReactElement | null {
  const { period } = useSchemaExplorerContext();
  const [query] = useQuery({
    query: SchemaTypeExplorer_Type,
    variables: {
      organization: organization.cleanId,
      project: project.cleanId,
      target: target.cleanId,
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

        const { totalRequests } = data.operationsStats;
        const { type } = data.target.latestSchemaVersion.explorer;
        if (!type) {
          return <div>No type found</div>;
        }

        return (
          <div className="space-y-4">
            <SchemaExplorerFilter
              organization={organization}
              project={project}
              target={target}
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

function ExplorerPage(): ReactElement | null {
  const router = useRouteSelector();
  const { typename } = router.query;

  if (typeof typename !== 'string') {
    return null;
  }

  return (
    <>
      <Title title={`Type ${typename}`} />
      <TargetLayout value="explorer">
        {props => (
          <SchemaExplorerProvider dataRetentionInDays={props.organization.rateLimit.retentionInDays}>
            <SchemaTypeExplorer {...props} typename={typename} />
          </SchemaExplorerProvider>
        )}
      </TargetLayout>
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(ExplorerPage);
