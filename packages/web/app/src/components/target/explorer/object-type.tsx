import { FragmentType, graphql, useFragment } from '@/gql';
import { useRouter } from '@tanstack/react-router';
import { GraphQLFields, GraphQLTypeCard } from './common';

const GraphQLObjectTypeComponent_TypeFragment = graphql(`
  fragment GraphQLObjectTypeComponent_TypeFragment on GraphQLObjectType {
    name
    description
    interfaces
    usage {
      ...SchemaExplorerUsageStats_UsageFragment
    }
    fields {
      ...GraphQLFields_FieldFragment
    }
    supergraphMetadata {
      ...GraphQLTypeCard_SupergraphMetadataFragment
    }
  }
`);

export function GraphQLObjectTypeComponent(props: {
  type: FragmentType<typeof GraphQLObjectTypeComponent_TypeFragment>;
  totalRequests?: number;
  collapsed?: boolean;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  warnAboutUnusedArguments: boolean;
  warnAboutDeprecatedArguments: boolean;
  styleDeprecated: boolean;
}) {
  const ttype = useFragment(GraphQLObjectTypeComponent_TypeFragment, props.type);
  const router = useRouter();
  const searchObj = router.latestLocation.search;
  const search =
    'search' in searchObj && typeof searchObj.search === 'string' ? searchObj.search : undefined;

  return (
    <GraphQLTypeCard
      kind="type"
      name={ttype.name}
      description={ttype.description}
      implements={ttype.interfaces}
      supergraphMetadata={ttype.supergraphMetadata}
      targetSlug={props.targetSlug}
      projectSlug={props.projectSlug}
      organizationSlug={props.organizationSlug}
    >
      <GraphQLFields
        typeName={ttype.name}
        fields={ttype.fields}
        filterValue={search}
        totalRequests={props.totalRequests}
        collapsed={props.collapsed}
        targetSlug={props.targetSlug}
        projectSlug={props.projectSlug}
        organizationSlug={props.organizationSlug}
        warnAboutDeprecatedArguments={props.warnAboutDeprecatedArguments}
        warnAboutUnusedArguments={props.warnAboutUnusedArguments}
        styleDeprecated={props.styleDeprecated}
      />
    </GraphQLTypeCard>
  );
}
