import { GraphQLTypeCard, GraphQLFields } from './common';
import { graphql, FragmentType, useFragment } from '@/gql';

export const GraphQLObjectTypeComponent_TypeFragment = graphql(/* GraphQL */ `
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
  }
`);

export function GraphQLObjectTypeComponent(props: {
  type: FragmentType<typeof GraphQLObjectTypeComponent_TypeFragment>;
  totalRequests: number;
  collapsed?: boolean;
}) {
  const ttype = useFragment(GraphQLObjectTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard kind="type" name={ttype.name} description={ttype.description} implements={ttype.interfaces}>
      <GraphQLFields fields={ttype.fields} totalRequests={props.totalRequests} collapsed={props.collapsed} />
    </GraphQLTypeCard>
  );
}
