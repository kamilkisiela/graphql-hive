import { gql, DocumentType } from 'urql';

const GraphQLScalarTypeComponent_TypeFragment = gql(/* GraphQL */ `
  fragment GraphQLScalarTypeComponent_TypeFragment on GraphQLScalarType {
    name
    description
    usage {
      total
      isUsed
    }
  }
`);

export function GraphQLScalarTypeComponent(props: {
  type: DocumentType<typeof GraphQLScalarTypeComponent_TypeFragment>;
}) {
  return <div>{props.type.name}</div>;
}
