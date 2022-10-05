import { GraphQLTypeCard, GraphQLInputFields } from './common';
import { graphql, FragmentType, useFragment } from '@/gql';

export const GraphQLInputObjectTypeComponent_TypeFragment = graphql(/* GraphQL */ `
  fragment GraphQLInputObjectTypeComponent_TypeFragment on GraphQLInputObjectType {
    name
    description
    usage {
      ...SchemaExplorerUsageStats_UsageFragment
    }
    fields {
      ...GraphQLInputFields_InputFieldFragment
    }
  }
`);

export function GraphQLInputObjectTypeComponent(props: {
  type: FragmentType<typeof GraphQLInputObjectTypeComponent_TypeFragment>;
  totalRequests: number;
}) {
  const ttype = useFragment(GraphQLInputObjectTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard kind="input" name={ttype.name} description={ttype.description}>
      <GraphQLInputFields fields={ttype.fields} totalRequests={props.totalRequests} />
    </GraphQLTypeCard>
  );
}
