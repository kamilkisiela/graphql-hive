import { gql, DocumentType } from 'urql';
import { GraphQLTypeCard, GraphQLFields } from './common';

const GraphQLInterfaceTypeComponent_TypeFragment = gql(/* GraphQL */ `
  fragment GraphQLInterfaceTypeComponent_TypeFragment on GraphQLInterfaceType {
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

export function GraphQLInterfaceTypeComponent(props: {
  type: DocumentType<typeof GraphQLInterfaceTypeComponent_TypeFragment>;
}) {
  return (
    <GraphQLTypeCard
      kind="interface"
      name={props.type.name}
      description={props.type.description}
      implements={props.type.interfaces}
    >
      <GraphQLFields fields={props.type.fields} />
    </GraphQLTypeCard>
  );
}
