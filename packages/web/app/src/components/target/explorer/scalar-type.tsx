import { Markdown } from '@/components/v2/markdown';
import { FragmentType, graphql, useFragment } from '@/gql';
import { GraphQLTypeCard, SchemaExplorerUsageStats } from './common';

export const GraphQLScalarTypeComponent_TypeFragment = graphql(`
  fragment GraphQLScalarTypeComponent_TypeFragment on GraphQLScalarType {
    name
    description
    usage {
      ...SchemaExplorerUsageStats_UsageFragment
    }
    supergraphMetadata {
      ...GraphQLTypeCard_SupergraphMetadataFragment
    }
  }
`);

export function GraphQLScalarTypeComponent(props: {
  type: FragmentType<typeof GraphQLScalarTypeComponent_TypeFragment>;
  totalRequests: number;
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
}) {
  const ttype = useFragment(GraphQLScalarTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard
      name={ttype.name}
      kind="scalar"
      supergraphMetadata={ttype.supergraphMetadata}
      targetCleanId={props.targetCleanId}
      projectCleanId={props.projectCleanId}
      organizationCleanId={props.organizationCleanId}
    >
      <div className="flex flex-row gap-4 p-4">
        <div className="grow text-sm">
          {typeof ttype.description === 'string' ? <Markdown content={ttype.description} /> : null}
        </div>
        <SchemaExplorerUsageStats
          totalRequests={props.totalRequests}
          usage={ttype.usage}
          targetCleanId={props.targetCleanId}
          projectCleanId={props.projectCleanId}
          organizationCleanId={props.organizationCleanId}
        />
      </div>
    </GraphQLTypeCard>
  );
}
