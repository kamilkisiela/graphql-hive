import { FragmentType, graphql, useFragment } from '@/gql';
import {
  GraphQLTypeCard,
  GraphQLTypeCardListItem,
  SchemaExplorerUsageStats,
  SupergraphMetadataTooltip,
} from './common';

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
        ...GraphQLTypeCard_SupergraphMetadataFragment
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
            <SchemaExplorerUsageStats totalRequests={props.totalRequests} usage={value.usage} />
            {value.supergraphMetadata ? (
              <SupergraphMetadataTooltip supergraphMetadata={value.supergraphMetadata} />
            ) : null}
          </GraphQLTypeCardListItem>
        ))}
      </div>
    </GraphQLTypeCard>
  );
}
