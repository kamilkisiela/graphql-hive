import { FragmentType, graphql, useFragment } from '@/gql';
import { useRouter } from '@tanstack/react-router';
import { GraphQLFields, GraphQLTypeCard } from './common';

export const GraphQLObjectTypeComponent_TypeFragment = graphql(`
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
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
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
      targetCleanId={props.targetCleanId}
      projectCleanId={props.projectCleanId}
      organizationCleanId={props.organizationCleanId}
    >
      <GraphQLFields
        typeName={ttype.name}
        fields={ttype.fields}
        filterValue={search}
        totalRequests={props.totalRequests}
        collapsed={props.collapsed}
        targetCleanId={props.targetCleanId}
        projectCleanId={props.projectCleanId}
        organizationCleanId={props.organizationCleanId}
        warnAboutDeprecatedArguments={props.warnAboutDeprecatedArguments}
        warnAboutUnusedArguments={props.warnAboutUnusedArguments}
        styleDeprecated={props.styleDeprecated}
      />
    </GraphQLTypeCard>
  );
}
