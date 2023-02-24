import { FragmentType, graphql, useFragment } from '@/gql';
import { GraphQLTypeCard, GraphQLTypeCardListItem, SchemaExplorerUsageStats } from './common';

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
    }
  }
`);

export function GraphQLEnumTypeComponent(props: {
  type: FragmentType<typeof GraphQLEnumTypeComponent_TypeFragment>;
  totalRequests: number;
}) {
  const ttype = useFragment(GraphQLEnumTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard name={ttype.name} kind="enum" description={ttype.description}>
      <div className="flex flex-col">
        {ttype.values.map((value, i) => (
          <GraphQLTypeCardListItem index={i}>
            <div>{value.name}</div>
            <SchemaExplorerUsageStats totalRequests={props.totalRequests} usage={value.usage} />
          </GraphQLTypeCardListItem>
        ))}
      </div>
    </GraphQLTypeCard>
  );
}
