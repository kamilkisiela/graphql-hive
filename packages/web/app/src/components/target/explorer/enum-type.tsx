import { FragmentType, graphql, useFragment } from '@/gql';
import {
  DeprecationNote,
  GraphQLTypeCard,
  GraphQLTypeCardListItem,
  LinkToCoordinatePage,
  SchemaExplorerUsageStats,
} from './common';
import { SupergraphMetadataList } from './super-graph-metadata';

export const GraphQLEnumTypeComponent_TypeFragment = graphql(`
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
      supergraphMetadata {
        ...SupergraphMetadataList_SupergraphMetadataFragment
      }
    }
    supergraphMetadata {
      ...GraphQLTypeCard_SupergraphMetadataFragment
    }
  }
`);

export function GraphQLEnumTypeComponent(props: {
  type: FragmentType<typeof GraphQLEnumTypeComponent_TypeFragment>;
  totalRequests?: number;
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
  styleDeprecated: boolean;
}) {
  const ttype = useFragment(GraphQLEnumTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard
      name={ttype.name}
      kind="enum"
      description={ttype.description}
      supergraphMetadata={ttype.supergraphMetadata}
      targetCleanId={props.targetCleanId}
      projectCleanId={props.projectCleanId}
      organizationCleanId={props.organizationCleanId}
    >
      <div className="flex flex-col">
        {ttype.values.map((value, i) => (
          <GraphQLTypeCardListItem key={value.name} index={i}>
            <div>
              <DeprecationNote
                styleDeprecated={props.styleDeprecated}
                deprecationReason={value.deprecationReason}
              >
                <LinkToCoordinatePage
                  organizationId={props.organizationCleanId}
                  projectId={props.projectCleanId}
                  targetId={props.targetCleanId}
                  coordinate={`${ttype.name}.${value.name}`}
                >
                  {value.name}
                </LinkToCoordinatePage>
              </DeprecationNote>
            </div>
            {value.supergraphMetadata ? (
              <SupergraphMetadataList
                targetId={props.targetCleanId}
                projectId={props.projectCleanId}
                organizationId={props.organizationCleanId}
                supergraphMetadata={value.supergraphMetadata}
              />
            ) : null}
            {typeof props.totalRequests === 'number' ? (
              <SchemaExplorerUsageStats
                totalRequests={props.totalRequests}
                usage={value.usage}
                targetCleanId={props.targetCleanId}
                projectCleanId={props.projectCleanId}
                organizationCleanId={props.organizationCleanId}
              />
            ) : null}
          </GraphQLTypeCardListItem>
        ))}
      </div>
    </GraphQLTypeCard>
  );
}
