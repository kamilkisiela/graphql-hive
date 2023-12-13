import { useRouter } from 'next/router';
import { FragmentType, graphql, useFragment } from '@/gql';
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
}) {
  const ttype = useFragment(GraphQLObjectTypeComponent_TypeFragment, props.type);
  const router = useRouter();

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
        filterValue={typeof router.query.search === 'string' ? router.query.search : undefined}
        totalRequests={props.totalRequests}
        collapsed={props.collapsed}
        targetCleanId={props.targetCleanId}
        projectCleanId={props.projectCleanId}
        organizationCleanId={props.organizationCleanId}
      />
    </GraphQLTypeCard>
  );
}
