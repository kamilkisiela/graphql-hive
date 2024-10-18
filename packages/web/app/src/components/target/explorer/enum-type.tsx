import { FragmentType, graphql, useFragment } from '@/gql';
import {
  DeprecationNote,
  GraphQLTypeCard,
  GraphQLTypeCardListItem,
  LinkToCoordinatePage,
  SchemaExplorerUsageStats,
} from './common';
import { SupergraphMetadataList } from './super-graph-metadata';

const GraphQLEnumTypeComponent_TypeFragment = graphql(`
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
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  styleDeprecated: boolean;
}) {
  const ttype = useFragment(GraphQLEnumTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard
      name={ttype.name}
      kind="enum"
      description={ttype.description}
      supergraphMetadata={ttype.supergraphMetadata}
      targetSlug={props.targetSlug}
      projectSlug={props.projectSlug}
      organizationSlug={props.organizationSlug}
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
                  organizationSlug={props.organizationSlug}
                  projectSlug={props.projectSlug}
                  targetSlug={props.targetSlug}
                  coordinate={`${ttype.name}.${value.name}`}
                >
                  {value.name}
                </LinkToCoordinatePage>
              </DeprecationNote>
            </div>
            {value.supergraphMetadata ? (
              <SupergraphMetadataList
                targetSlug={props.targetSlug}
                projectSlug={props.projectSlug}
                organizationSlug={props.organizationSlug}
                supergraphMetadata={value.supergraphMetadata}
              />
            ) : null}
            {typeof props.totalRequests === 'number' ? (
              <SchemaExplorerUsageStats
                totalRequests={props.totalRequests}
                usage={value.usage}
                targetSlug={props.targetSlug}
                projectSlug={props.projectSlug}
                organizationSlug={props.organizationSlug}
              />
            ) : null}
          </GraphQLTypeCardListItem>
        ))}
      </div>
    </GraphQLTypeCard>
  );
}
