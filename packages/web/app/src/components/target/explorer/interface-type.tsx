import { DocumentType, gql } from 'urql';
import { GraphQLFields, GraphQLTypeCard } from './common';

export const GraphQLInterfaceTypeComponent_TypeFragment = gql(/* GraphQL */ `
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
  type: DocumentType<typeof GraphQLInterfaceTypeComponent_TypeFragment>;
  totalRequests: number;
}) {
  return (
    <GraphQLTypeCard
      kind="interface"
      name={props.type.name}
      description={props.type.description}
      implements={props.type.interfaces}
    >
      <GraphQLFields fields={props.type.fields} totalRequests={props.totalRequests} />
    </GraphQLTypeCard>
  );
}
