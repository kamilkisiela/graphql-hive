import { FragmentType, graphql, useFragment } from '@/gql';
import { GraphQLInputFields, GraphQLTypeCard } from './common';

export const GraphQLInputObjectTypeComponent_TypeFragment = graphql(`
  fragment GraphQLInputObjectTypeComponent_TypeFragment on GraphQLInputObjectType {
    name
    description
    usage {
      ...SchemaExplorerUsageStats_UsageFragment
    }
    fields {
      ...GraphQLInputFields_InputFieldFragment
    }
    supergraphMetadata {
      ...GraphQLTypeCard_SupergraphMetadataFragment
    }
  }
`);

export function GraphQLInputObjectTypeComponent(props: {
  type: FragmentType<typeof GraphQLInputObjectTypeComponent_TypeFragment>;
  totalRequests?: number;
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
}) {
  const ttype = useFragment(GraphQLInputObjectTypeComponent_TypeFragment, props.type);
  return (
    <GraphQLTypeCard
      kind="input"
      name={ttype.name}
      description={ttype.description}
      totalRequests={props.totalRequests}
      usage={ttype.usage}
      supergraphMetadata={ttype.supergraphMetadata}
      targetCleanId={props.targetCleanId}
      projectCleanId={props.projectCleanId}
      organizationCleanId={props.organizationCleanId}
    >
      <GraphQLInputFields
        typeName={ttype.name}
        fields={ttype.fields}
        totalRequests={props.totalRequests}
        targetCleanId={props.targetCleanId}
        projectCleanId={props.projectCleanId}
        organizationCleanId={props.organizationCleanId}
      />
    </GraphQLTypeCard>
  );
}
