import { FragmentType, graphql, useFragment } from '@/gql';
import { GraphQLFields, GraphQLTypeCard } from './common';

export const GraphQLObjectTypeComponent_TypeFragment = graphql(`
  fragment GraphQLObjectTypeComponent_TypeFragment on GraphQLObjectType {
    name
    description
    interfaces
    usage {
      ...SchemaExplorerUsageStats_UsageFragment
    }
    fields {
      ...GraphQLFields_FieldFragment
    }
    supergraphMetadata {
      ...GraphQLTypeCard_SupergraphMetadataFragment
    }
  }
`);

export function GraphQLObjectTypeComponent(props: {
  type: FragmentType<typeof GraphQLObjectTypeComponent_TypeFragment>;
  totalRequests: number;
  collapsed?: boolean;
}) {
  const ttype = useFragment(GraphQLObjectTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard
      kind="type"
      name={ttype.name}
      description={ttype.description}
      implements={ttype.interfaces}
      supergraphMetadata={ttype.supergraphMetadata}
    >
      <GraphQLFields
        fields={ttype.fields}
        totalRequests={props.totalRequests}
        collapsed={props.collapsed}
      />
    </GraphQLTypeCard>
  );
}
