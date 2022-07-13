import { gql, DocumentType } from 'urql';
import { GraphQLTypeCard, GraphQLInputFields } from './common';

const GraphQLInputObjectTypeComponent_TypeFragment = gql(/* GraphQL */ `
  fragment GraphQLInputObjectTypeComponent_TypeFragment on GraphQLInputObjectType {
    name
    description
    usage {
      total
      isUsed
    }
    fields {
      ...GraphQLInputFields_InputFieldFragment
    }
  }
`);

export function GraphQLInputObjectTypeComponent(props: {
  type: DocumentType<typeof GraphQLInputObjectTypeComponent_TypeFragment>;
}) {
  return (
    <GraphQLTypeCard kind="input" name={props.type.name} description={props.type.description}>
      <GraphQLInputFields fields={props.type.fields} />
    </GraphQLTypeCard>
  );
}
