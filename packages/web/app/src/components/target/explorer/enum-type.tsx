import { FragmentType, graphql, useFragment } from '@/gql';
import { GraphQLTypeCard, GraphQLTypeCardListItem, SchemaExplorerUsageStats } from './common';
import { SupergraphMetadataList } from './super-graph-metadata';

export const GraphQLEnumTypeComponent_TypeFragment = graphql(`
  fragment GraphQLEnumTypeComponent_TypeFragment on GraphQLEnumType {
    name
    description
    usage {
      ...SchemaExplorerUsageStats_UsageFragment
    }
    values {
      name
      description
      isDeprecated
      deprecationReason
      usage {
        ...SchemaExplorerUsageStats_UsageFragment
      }
      supergraphMetadata {
        ...SupergraphMetadataList_SupergraphMetadataFragment
      }
    }
    supergraphMetadata {
      ...GraphQLTypeCard_SupergraphMetadataFragment
    }
  }
`);

export function GraphQLEnumTypeComponent(props: {
  type: FragmentType<typeof GraphQLEnumTypeComponent_TypeFragment>;
  totalRequests: number;
}) {
  const ttype = useFragment(GraphQLEnumTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard
      name={ttype.name}
      kind="enum"
      description={ttype.description}
      supergraphMetadata={ttype.supergraphMetadata}
    >
      <div className="flex flex-col">
        {ttype.values.map((value, i) => (
          <GraphQLTypeCardListItem index={i}>
            <div>{value.name}</div>
            {value.supergraphMetadata ? (
              <SupergraphMetadataList supergraphMetadata={value.supergraphMetadata} />
            ) : null}
            <SchemaExplorerUsageStats totalRequests={props.totalRequests} usage={value.usage} />
          </GraphQLTypeCardListItem>
        ))}
      </div>
    </GraphQLTypeCard>
  );
}
