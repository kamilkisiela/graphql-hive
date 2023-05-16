import { FragmentType, graphql, useFragment } from '@/gql';
import {
  GraphQLTypeCard,
  GraphQLTypeCardListItem,
  SchemaExplorerUsageStats,
  SupergraphMetadataTooltip,
} from './common';

export const GraphQLUnionTypeComponent_TypeFragment = graphql(`
  fragment GraphQLUnionTypeComponent_TypeFragment on GraphQLUnionType {
    name
    description
    usage {
      ...SchemaExplorerUsageStats_UsageFragment
    }
    members {
      name
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

export function GraphQLUnionTypeComponent(props: {
  type: FragmentType<typeof GraphQLUnionTypeComponent_TypeFragment>;
  totalRequests: number;
}) {
  const ttype = useFragment(GraphQLUnionTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard
      name={ttype.name}
      kind="union"
      description={ttype.description}
      supergraphMetadata={ttype.supergraphMetadata}
    >
      <div className="flex flex-col">
        {ttype.members.map((member, i) => (
          <GraphQLTypeCardListItem index={i}>
            <div>{member.name}</div>
            <SchemaExplorerUsageStats totalRequests={props.totalRequests} usage={member.usage} />
            {member.supergraphMetadata ? (
              <SupergraphMetadataTooltip supergraphMetadata={member.supergraphMetadata} />
            ) : null}
          </GraphQLTypeCardListItem>
        ))}
      </div>
    </GraphQLTypeCard>
  );
}
