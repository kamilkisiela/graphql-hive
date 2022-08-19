import { ReactElement } from 'react';
import { DocumentType, gql, useQuery } from 'urql';

import { authenticated, withSessionProtection } from '@/components/authenticated-container';
import { TargetLayout } from '@/components/layouts';
import {
  GraphQLEnumTypeComponent,
  GraphQLEnumTypeComponent_TypeFragment,
} from '@/components/target/explorer/enum-type';
import { SchemaExplorerFilter } from '@/components/target/explorer/filter';
import {
  GraphQLInputObjectTypeComponent,
  GraphQLInputObjectTypeComponent_TypeFragment,
} from '@/components/target/explorer/input-object-type';
import {
  GraphQLInterfaceTypeComponent,
  GraphQLInterfaceTypeComponent_TypeFragment,
} from '@/components/target/explorer/interface-type';
import {
  GraphQLObjectTypeComponent,
  GraphQLObjectTypeComponent_TypeFragment,
} from '@/components/target/explorer/object-type';
import { SchemaExplorerProvider, useSchemaExplorerContext } from '@/components/target/explorer/provider';
import {
  GraphQLScalarTypeComponent,
  GraphQLScalarTypeComponent_TypeFragment,
} from '@/components/target/explorer/scalar-type';
import {
  GraphQLUnionTypeComponent,
  GraphQLUnionTypeComponent_TypeFragment,
} from '@/components/target/explorer/union-type';
import { DataWrapper, noSchema, Title } from '@/components/v2';
import { OrganizationFieldsFragment, ProjectFieldsFragment, TargetFieldsFragment } from '@/graphql';
import { useRouteSelector } from '@/lib/hooks/use-route-selector';

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

type GraphQLNamedType =
  | DocumentType<typeof GraphQLEnumTypeComponent_TypeFragment>
  | DocumentType<typeof GraphQLInputObjectTypeComponent_TypeFragment>
  | DocumentType<typeof GraphQLInterfaceTypeComponent_TypeFragment>
  | DocumentType<typeof GraphQLObjectTypeComponent_TypeFragment>
  | DocumentType<typeof GraphQLScalarTypeComponent_TypeFragment>
  | DocumentType<typeof GraphQLUnionTypeComponent_TypeFragment>;

function TypeRenderer({ type, totalRequests }: { type: GraphQLNamedType; totalRequests: number }) {
  switch (type.__typename) {
    case 'GraphQLObjectType':
      return <GraphQLObjectTypeComponent type={type} totalRequests={totalRequests} />;
    case 'GraphQLInterfaceType':
      return <GraphQLInterfaceTypeComponent type={type} totalRequests={totalRequests} />;
    case 'GraphQLUnionType':
      return <GraphQLUnionTypeComponent type={type} totalRequests={totalRequests} />;
    case 'GraphQLEnumType':
      return <GraphQLEnumTypeComponent type={type} totalRequests={totalRequests} />;
    case 'GraphQLInputObjectType':
      return <GraphQLInputObjectTypeComponent type={type} totalRequests={totalRequests} />;
    case 'GraphQLScalarType':
      return <GraphQLScalarTypeComponent type={type} totalRequests={totalRequests} />;
    default:
      return <div>Unknown type: {type.__typename}</div>;
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

        const { type } = data.target.latestSchemaVersion.explorer;
        const { totalRequests } = data.operationsStats;

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
