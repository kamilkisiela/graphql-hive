import { DocumentType, gql } from 'urql';
import { GraphQLTypeCard, GraphQLTypeCardListItem, SchemaExplorerUsageStats } from './common';

export const GraphQLEnumTypeComponent_TypeFragment = gql(/* GraphQL */ `
  fragment GraphQLEnumTypeComponent_TypeFragment on GraphQLEnumType {
    name
    description
    usage {
      ...SchemaExplorerUsageStats_UsageFragment
    }
    values {
      name
      description
      isDeprecated
      deprecationReason
      usage {
        ...SchemaExplorerUsageStats_UsageFragment
      }
    }
  }
`);

export function GraphQLEnumTypeComponent(props: {
  type: DocumentType<typeof GraphQLEnumTypeComponent_TypeFragment>;
  totalRequests: number;
}) {
  return (
    <GraphQLTypeCard name={props.type.name} kind="enum" description={props.type.description}>
      <div className="flex flex-col">
        {props.type.values.map((value, i) => (
          <GraphQLTypeCardListItem index={i}>
            <div>{value.name}</div>
            <SchemaExplorerUsageStats totalRequests={props.totalRequests} usage={value.usage} />
          </GraphQLTypeCardListItem>
        ))}
      </div>
    </GraphQLTypeCard>
  );
}
