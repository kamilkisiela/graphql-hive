import { Markdown } from '@/components/v2/markdown';
import { FragmentType, graphql, useFragment } from '@/gql';
import { GraphQLTypeCard, SchemaExplorerUsageStats } from './common';

const GraphQLScalarTypeComponent_TypeFragment = graphql(`
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
  totalRequests?: number;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const ttype = useFragment(GraphQLScalarTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard
      name={ttype.name}
      kind="scalar"
      supergraphMetadata={ttype.supergraphMetadata}
      targetSlug={props.targetSlug}
      projectSlug={props.projectSlug}
      organizationSlug={props.organizationSlug}
    >
      <div className="flex flex-row gap-4 p-4">
        <div className="grow text-sm">
          {typeof ttype.description === 'string' ? <Markdown content={ttype.description} /> : null}
        </div>
        {typeof props.totalRequests === 'number' ? (
          <SchemaExplorerUsageStats
            totalRequests={props.totalRequests}
            usage={ttype.usage}
            targetSlug={props.targetSlug}
            projectSlug={props.projectSlug}
            organizationSlug={props.organizationSlug}
          />
        ) : null}
      </div>
    </GraphQLTypeCard>
  );
}
