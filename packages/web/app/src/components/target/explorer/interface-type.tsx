import { GraphQLTypeCard, GraphQLFields } from './common';
import { graphql, FragmentType, useFragment } from '@/gql';

export const GraphQLInterfaceTypeComponent_TypeFragment = graphql(/* GraphQL */ `
  fragment GraphQLInterfaceTypeComponent_TypeFragment on GraphQLInterfaceType {
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

export function GraphQLInterfaceTypeComponent(props: {
  type: FragmentType<typeof GraphQLInterfaceTypeComponent_TypeFragment>;
  totalRequests: number;
}) {
  const ttype = useFragment(GraphQLInterfaceTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard kind="interface" name={ttype.name} description={ttype.description} implements={ttype.interfaces}>
      <GraphQLFields fields={ttype.fields} totalRequests={props.totalRequests} />
    </GraphQLTypeCard>
  );
}
