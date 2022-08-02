import { gql, DocumentType } from 'urql';
import { Markdown } from '@/components/v2/markdown';
import { GraphQLTypeCard, SchemaExplorerUsageStats } from './common';

export const GraphQLScalarTypeComponent_TypeFragment = gql(/* GraphQL */ `
  fragment GraphQLScalarTypeComponent_TypeFragment on GraphQLScalarType {
    name
    description
    usage {
      ...SchemaExplorerUsageStats_UsageFragment
    }
  }
`);

export function GraphQLScalarTypeComponent(props: {
  type: DocumentType<typeof GraphQLScalarTypeComponent_TypeFragment>;
  totalRequests: number;
}) {
  return (
    <GraphQLTypeCard name={props.type.name} kind="scalar">
      <div className="flex flex-row gap-4 p-4">
        <div className="flex-grow text-sm">
          {typeof props.type.description === 'string' ? <Markdown content={props.type.description} /> : null}
        </div>
        <SchemaExplorerUsageStats totalRequests={props.totalRequests} usage={props.type.usage} />
      </div>
    </GraphQLTypeCard>
  );
}
