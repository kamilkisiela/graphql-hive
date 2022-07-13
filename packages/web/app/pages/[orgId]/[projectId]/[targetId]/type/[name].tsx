import { ReactElement } from 'react';
import { formatISO, subDays } from 'date-fns';
import { gql, useQuery } from 'urql';

import { TargetLayout } from '@/components/layouts';
import { GraphQLEnumTypeComponent } from '@/components/target/explorer/enum-type';
import { GraphQLInputObjectTypeComponent } from '@/components/target/explorer/input-object-type';
import { GraphQLInterfaceTypeComponent } from '@/components/target/explorer/interface-type';
import { GraphQLObjectTypeComponent } from '@/components/target/explorer/object-type';
import { GraphQLScalarTypeComponent } from '@/components/target/explorer/scalar-type';
import { GraphQLUnionTypeComponent } from '@/components/target/explorer/union-type';
import { DataWrapper, noSchema, Title } from '@/components/v2';
import { OrganizationFieldsFragment, ProjectFieldsFragment, TargetFieldsFragment } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

function floorDate(date: Date): Date {
  const time = 1000 * 60;
  return new Date(Math.floor(date.getTime() / time) * time);
}

const SchemaTypeExplorer_Type = gql(/* GraphQL */ `
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
            ...GraphQLObjectTypeComponent_TypeFragment
            ...GraphQLInterfaceTypeComponent_TypeFragment
            ...GraphQLUnionTypeComponent_TypeFragment
            ...GraphQLEnumTypeComponent_TypeFragment
            ...GraphQLInputObjectTypeComponent_TypeFragment
            ...GraphQLScalarTypeComponent_TypeFragment
          }
        }
      }
    }
    operationsStats(selector: { organization: $organization, project: $project, target: $target, period: $period }) {
      totalRequests
    }
  }
`);

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
  const now = new Date();
  const [query] = useQuery({
    query: SchemaTypeExplorer_Type,
    variables: {
      organization: organization.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      period: {
        to: floorDate(now),
        from: formatISO(subDays(now, 60)),
      },
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

        switch (type.__typename) {
          case 'GraphQLObjectType':
            return <GraphQLObjectTypeComponent type={type} totalRequests={totalRequests} />;
          case 'GraphQLInterfaceType':
            return <GraphQLInterfaceTypeComponent type={type} totalRequests={totalRequests} />;
          case 'GraphQLUnionType':
            return <GraphQLUnionTypeComponent type={type} />;
          case 'GraphQLEnumType':
            return <GraphQLEnumTypeComponent type={type} />;
          case 'GraphQLInputObjectType':
            return <GraphQLInputObjectTypeComponent type={type} totalRequests={totalRequests} />;
          case 'GraphQLScalarType':
            return <GraphQLScalarTypeComponent type={type} />;
        }
      }}
    </DataWrapper>
  );
}

export default function ExplorerPage(): ReactElement | null {
  const router = useRouteSelector();
  const typename = router.query.name;

  if (typeof typename !== 'string') {
    return null;
  }

  return (
    <>
      <Title title={`Type ${typename}`} />
      <TargetLayout value="explorer">{props => <SchemaTypeExplorer {...props} typename={typename} />}</TargetLayout>
    </>
  );
}
