import { gql, DocumentType } from 'urql';

const GraphQLEnumTypeComponent_TypeFragment = gql(/* GraphQL */ `
  fragment GraphQLEnumTypeComponent_TypeFragment on GraphQLEnumType {
    name
    description
    usage {
      total
      isUsed
    }
    values {
      name
      description
      isDeprecated
      deprecationReason
      usage {
        total
        isUsed
      }
    }
  }
`);

export function GraphQLEnumTypeComponent(props: { type: DocumentType<typeof GraphQLEnumTypeComponent_TypeFragment> }) {
  return <div>{props.type.name}</div>;
}
