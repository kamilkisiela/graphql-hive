import { gql, DocumentType } from 'urql';
import { GraphQLTypeCard, GraphQLFields } from './common';

export const GraphQLObjectTypeComponent_TypeFragment = gql(/* GraphQL */ `
  fragment GraphQLObjectTypeComponent_TypeFragment on GraphQLObjectType {
    name
    description
    interfaces
    usage {
      total
      isUsed
    }
    fields {
      ...GraphQLFields_FieldFragment
    }
  }
`);

export function GraphQLObjectTypeComponent(props: {
  type: DocumentType<typeof GraphQLObjectTypeComponent_TypeFragment>;
  totalRequests: number;
}) {
  return (
    <GraphQLTypeCard
      kind="type"
      name={props.type.name}
      description={props.type.description}
      implements={props.type.interfaces}
    >
      <GraphQLFields fields={props.type.fields} totalRequests={props.totalRequests} />
    </GraphQLTypeCard>
  );
}
