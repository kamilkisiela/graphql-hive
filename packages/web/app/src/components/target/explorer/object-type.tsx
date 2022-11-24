import { gql, DocumentType } from 'urql';
import { GraphQLTypeCard, GraphQLFields } from './common';

export const GraphQLObjectTypeComponent_TypeFragment = gql(/* GraphQL */ `
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
  type: DocumentType<typeof GraphQLObjectTypeComponent_TypeFragment>;
  totalRequests: number;
  collapsed?: boolean;
}) {
  return (
    <GraphQLTypeCard
      kind="type"
      name={props.type.name}
      description={props.type.description}
      implements={props.type.interfaces}
    >
      <GraphQLFields
        fields={props.type.fields}
        totalRequests={props.totalRequests}
        collapsed={props.collapsed}
      />
    </GraphQLTypeCard>
  );
}
