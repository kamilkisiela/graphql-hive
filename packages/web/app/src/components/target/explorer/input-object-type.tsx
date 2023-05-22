import { FragmentType, graphql, useFragment } from '@/gql';
import { GraphQLInputFields, GraphQLTypeCard } from './common';

export const GraphQLInputObjectTypeComponent_TypeFragment = graphql(`
  fragment GraphQLInputObjectTypeComponent_TypeFragment on GraphQLInputObjectType {
    name
    description
    usage {
      ...SchemaExplorerUsageStats_UsageFragment
    }
    fields {
      ...GraphQLInputFields_InputFieldFragment
    }
    supergraphMetadata {
      ...GraphQLTypeCard_SupergraphMetadataFragment
    }
  }
`);

export function GraphQLInputObjectTypeComponent(props: {
  type: FragmentType<typeof GraphQLInputObjectTypeComponent_TypeFragment>;
  totalRequests: number;
}) {
  const ttype = useFragment(GraphQLInputObjectTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard
      kind="input"
      name={ttype.name}
      description={ttype.description}
      totalRequests={props.totalRequests}
      usage={ttype.usage}
      supergraphMetadata={ttype.supergraphMetadata}
    >
      <GraphQLInputFields fields={ttype.fields} totalRequests={props.totalRequests} />
    </GraphQLTypeCard>
  );
}
