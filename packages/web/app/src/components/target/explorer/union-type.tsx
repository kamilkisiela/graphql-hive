import { gql, DocumentType } from 'urql';
import { GraphQLTypeCard, GraphQLTypeCardListItem, SchemaExplorerUsageStats } from './common';

export const GraphQLUnionTypeComponent_TypeFragment = gql(/* GraphQL */ `
  fragment GraphQLUnionTypeComponent_TypeFragment on GraphQLUnionType {
    name
    description
    usage {
      ...SchemaExplorerUsageStats_UsageFragment
    }
    members {
      name
      usage {
        ...SchemaExplorerUsageStats_UsageFragment
      }
    }
  }
`);

export function GraphQLUnionTypeComponent(props: {
  type: DocumentType<typeof GraphQLUnionTypeComponent_TypeFragment>;
  totalRequests: number;
}) {
  return (
    <GraphQLTypeCard name={props.type.name} kind="union" description={props.type.description}>
      <div className="flex flex-col">
        {props.type.members.map((member, i) => (
          <GraphQLTypeCardListItem index={i}>
            <div>{member.name}</div>
            <SchemaExplorerUsageStats totalRequests={props.totalRequests} usage={member.usage} />
          </GraphQLTypeCardListItem>
        ))}
      </div>
    </GraphQLTypeCard>
  );
}
