import { FragmentType, graphql, useFragment } from '@/gql';
import { GraphQLInputFields, GraphQLTypeCard } from './common';

const GraphQLInputObjectTypeComponent_TypeFragment = graphql(`
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
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  styleDeprecated: boolean;
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
      targetSlug={props.targetSlug}
      projectSlug={props.projectSlug}
      organizationSlug={props.organizationSlug}
    >
      <GraphQLInputFields
        typeName={ttype.name}
        fields={ttype.fields}
        totalRequests={props.totalRequests}
        targetSlug={props.targetSlug}
        projectSlug={props.projectSlug}
        organizationSlug={props.organizationSlug}
        styleDeprecated={props.styleDeprecated}
      />
    </GraphQLTypeCard>
  );
}
