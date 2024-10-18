import { FragmentType, graphql, useFragment } from '@/gql';
import { GraphQLTypeCard, GraphQLTypeCardListItem, SchemaExplorerUsageStats } from './common';
import { SupergraphMetadataList } from './super-graph-metadata';

const GraphQLUnionTypeComponent_TypeFragment = graphql(`
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
      supergraphMetadata {
        ...SupergraphMetadataList_SupergraphMetadataFragment
      }
    }
    supergraphMetadata {
      ...GraphQLTypeCard_SupergraphMetadataFragment
      ...SupergraphMetadataList_SupergraphMetadataFragment
    }
  }
`);

export function GraphQLUnionTypeComponent(props: {
  type: FragmentType<typeof GraphQLUnionTypeComponent_TypeFragment>;
  totalRequests?: number;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const ttype = useFragment(GraphQLUnionTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard
      name={ttype.name}
      kind="union"
      description={ttype.description}
      supergraphMetadata={ttype.supergraphMetadata}
      targetSlug={props.targetSlug}
      projectSlug={props.projectSlug}
      organizationSlug={props.organizationSlug}
    >
      <div className="flex flex-col">
        {ttype.members.map((member, i) => (
          <GraphQLTypeCardListItem key={member.name} index={i}>
            <div>{member.name}</div>
            {typeof props.totalRequests === 'number' ? (
              <SchemaExplorerUsageStats
                totalRequests={props.totalRequests}
                usage={member.usage}
                targetSlug={props.targetSlug}
                projectSlug={props.projectSlug}
                organizationSlug={props.organizationSlug}
              />
            ) : null}
            {member.supergraphMetadata ? (
              <SupergraphMetadataList
                targetSlug={props.targetSlug}
                projectSlug={props.projectSlug}
                organizationSlug={props.organizationSlug}
                supergraphMetadata={member.supergraphMetadata}
              />
            ) : null}
          </GraphQLTypeCardListItem>
        ))}
      </div>
    </GraphQLTypeCard>
  );
}
