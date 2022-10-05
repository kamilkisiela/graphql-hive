import { Markdown } from '@/components/v2/markdown';
import { GraphQLTypeCard, SchemaExplorerUsageStats } from './common';
import { FragmentType, graphql, useFragment } from '@/gql';

export const GraphQLScalarTypeComponent_TypeFragment = graphql(/* GraphQL */ `
  fragment GraphQLScalarTypeComponent_TypeFragment on GraphQLScalarType {
    name
    description
    usage {
      ...SchemaExplorerUsageStats_UsageFragment
    }
  }
`);

export function GraphQLScalarTypeComponent(props: {
  type: FragmentType<typeof GraphQLScalarTypeComponent_TypeFragment>;
  totalRequests: number;
}) {
  const ttype = useFragment(GraphQLScalarTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard name={ttype.name} kind="scalar">
      <div className="flex flex-row gap-4 p-4">
        <div className="flex-grow text-sm">
          {typeof ttype.description === 'string' ? <Markdown content={ttype.description} /> : null}
        </div>
        <SchemaExplorerUsageStats totalRequests={props.totalRequests} usage={ttype.usage} />
      </div>
    </GraphQLTypeCard>
  );
}
