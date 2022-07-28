import { gql, DocumentType } from 'urql';

export const GraphQLUnionTypeComponent_TypeFragment = gql(/* GraphQL */ `
  fragment GraphQLUnionTypeComponent_TypeFragment on GraphQLUnionType {
    name
    description
    usage {
      total
      isUsed
    }
    members {
      name
      usage {
        total
        isUsed
      }
    }
  }
`);

export function GraphQLUnionTypeComponent(props: {
  type: DocumentType<typeof GraphQLUnionTypeComponent_TypeFragment>;
}) {
  return <div>{props.type.name}</div>;
}
