import { useEffect } from 'react';
import { useQuery } from 'urql';
import { Page, TargetLayout } from '@/components/layouts/target';
import { GraphQLEnumTypeComponent } from '@/components/target/explorer/enum-type';
import {
  ArgumentVisibilityFilter,
  DateRangeFilter,
  FieldByNameFilter,
  SchemaVariantFilter,
  TypeFilter,
} from '@/components/target/explorer/filter';
import { GraphQLInputObjectTypeComponent } from '@/components/target/explorer/input-object-type';
import { GraphQLInterfaceTypeComponent } from '@/components/target/explorer/interface-type';
import { GraphQLObjectTypeComponent } from '@/components/target/explorer/object-type';
import {
  SchemaExplorerProvider,
  useSchemaExplorerContext,
} from '@/components/target/explorer/provider';
import { GraphQLScalarTypeComponent } from '@/components/target/explorer/scalar-type';
import { GraphQLUnionTypeComponent } from '@/components/target/explorer/union-type';
import { noSchemaVersion } from '@/components/ui/empty-list';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { FragmentType, graphql, useFragment } from '@/gql';

export const TypeRenderFragment = graphql(`
  fragment TypeRenderFragment on GraphQLNamedType {
    __typename
    ...GraphQLObjectTypeComponent_TypeFragment
    ...GraphQLInterfaceTypeComponent_TypeFragment
    ...GraphQLUnionTypeComponent_TypeFragment
    ...GraphQLEnumTypeComponent_TypeFragment
    ...GraphQLInputObjectTypeComponent_TypeFragment
    ...GraphQLScalarTypeComponent_TypeFragment
  }
`);

export function TypeRenderer(props: {
  type: FragmentType<typeof TypeRenderFragment>;
  totalRequests?: number;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  warnAboutUnusedArguments: boolean;
  warnAboutDeprecatedArguments: boolean;
  styleDeprecated: boolean;
}) {
  const ttype = useFragment(TypeRenderFragment, props.type);
  switch (ttype.__typename) {
    case 'GraphQLObjectType':
      return (
        <GraphQLObjectTypeComponent
          type={ttype}
          totalRequests={props.totalRequests}
          targetSlug={props.targetSlug}
          projectSlug={props.projectSlug}
          organizationSlug={props.organizationSlug}
          warnAboutUnusedArguments={props.warnAboutUnusedArguments}
          warnAboutDeprecatedArguments={props.warnAboutDeprecatedArguments}
          styleDeprecated={props.styleDeprecated}
        />
      );
    case 'GraphQLInterfaceType':
      return (
        <GraphQLInterfaceTypeComponent
          type={ttype}
          totalRequests={props.totalRequests}
          targetSlug={props.targetSlug}
          projectSlug={props.projectSlug}
          organizationSlug={props.organizationSlug}
          warnAboutUnusedArguments={props.warnAboutUnusedArguments}
          warnAboutDeprecatedArguments={props.warnAboutDeprecatedArguments}
          styleDeprecated={props.styleDeprecated}
        />
      );
    case 'GraphQLUnionType':
      return (
        <GraphQLUnionTypeComponent
          type={ttype}
          totalRequests={props.totalRequests}
          targetSlug={props.targetSlug}
          projectSlug={props.projectSlug}
          organizationSlug={props.organizationSlug}
        />
      );
    case 'GraphQLEnumType':
      return (
        <GraphQLEnumTypeComponent
          type={ttype}
          totalRequests={props.totalRequests}
          targetSlug={props.targetSlug}
          projectSlug={props.projectSlug}
          organizationSlug={props.organizationSlug}
          styleDeprecated={props.styleDeprecated}
        />
      );
    case 'GraphQLInputObjectType':
      return (
        <GraphQLInputObjectTypeComponent
          type={ttype}
          totalRequests={props.totalRequests}
          targetSlug={props.targetSlug}
          projectSlug={props.projectSlug}
          organizationSlug={props.organizationSlug}
          styleDeprecated={props.styleDeprecated}
        />
      );
    case 'GraphQLScalarType':
      return (
        <GraphQLScalarTypeComponent
          type={ttype}
          totalRequests={props.totalRequests}
          targetSlug={props.targetSlug}
          projectSlug={props.projectSlug}
          organizationSlug={props.organizationSlug}
        />
      );
    default:
      return <div>Unknown type: {(ttype as any).__typename}</div>;
  }
}

const TargetExplorerTypenamePageQuery = graphql(`
  query TargetExplorerTypenamePageQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
    $period: DateRangeInput!
    $typename: String!
  ) {
    organization(selector: { organizationSlug: $organizationSlug }) {
      organization {
        id
        slug
        rateLimit {
          retentionInDays
        }
      }
    }
    target(
      selector: {
        organizationSlug: $organizationSlug
        projectSlug: $projectSlug
        targetSlug: $targetSlug
      }
    ) {
      id
      slug
      latestSchemaVersion {
        __typename
        id
        valid
        explorer(usage: { period: $period }) {
          type(name: $typename) {
            ...TypeRenderFragment
          }
        }
      }
    }
    operationsStats(
      selector: {
        organizationSlug: $organizationSlug
        projectSlug: $projectSlug
        targetSlug: $targetSlug
        period: $period
      }
    ) {
      totalRequests
    }
  }
`);

function TypeExplorerPageContent(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  typename: string;
}) {
  const { resolvedPeriod, dataRetentionInDays, setDataRetentionInDays } =
    useSchemaExplorerContext();
  const [query] = useQuery({
    query: TargetExplorerTypenamePageQuery,
    variables: {
      organizationSlug: props.organizationSlug,
      projectSlug: props.projectSlug,
      targetSlug: props.targetSlug,
      period: resolvedPeriod,
      typename: props.typename,
    },
  });

  const currentOrganization = query.data?.organization?.organization;
  const retentionInDays = currentOrganization?.rateLimit.retentionInDays;

  useEffect(() => {
    if (typeof retentionInDays === 'number' && dataRetentionInDays !== retentionInDays) {
      setDataRetentionInDays(retentionInDays);
    }
  }, [setDataRetentionInDays, retentionInDays]);

  if (query.error) {
    return <QueryError organizationSlug={props.organizationSlug} error={query.error} />;
  }

  const currentTarget = query.data?.target;
  const type = currentTarget?.latestSchemaVersion?.explorer?.type;
  const latestSchemaVersion = currentTarget?.latestSchemaVersion;

  return (
    <TargetLayout
      organizationSlug={props.organizationSlug}
      projectSlug={props.projectSlug}
      targetSlug={props.targetSlug}
      page={Page.Explorer}
    >
      <div className="flex flex-row items-center justify-between py-6">
        <div>
          <Title>Explore</Title>
          <Subtitle>Insights from the latest version.</Subtitle>
        </div>
        <div className="flex flex-row items-center gap-x-4">
          {latestSchemaVersion && type ? (
            <>
              <TypeFilter
                organizationSlug={props.organizationSlug}
                projectSlug={props.projectSlug}
                targetSlug={props.targetSlug}
                period={resolvedPeriod}
                typename={props.typename}
              />
              <FieldByNameFilter />
              <DateRangeFilter />
              <ArgumentVisibilityFilter />
              <SchemaVariantFilter
                organizationSlug={props.organizationSlug}
                projectSlug={props.projectSlug}
                targetSlug={props.targetSlug}
                variant="all"
              />
            </>
          ) : null}
        </div>
      </div>
      {query.fetching ? null : latestSchemaVersion && type ? (
        <TypeRenderer
          totalRequests={query.data?.operationsStats.totalRequests ?? 0}
          type={type}
          organizationSlug={props.organizationSlug}
          projectSlug={props.projectSlug}
          targetSlug={props.targetSlug}
          warnAboutDeprecatedArguments={false}
          warnAboutUnusedArguments={false}
          styleDeprecated
        />
      ) : type ? (
        noSchemaVersion
      ) : (
        <div>Not found</div>
      )}
    </TargetLayout>
  );
}

export function TargetExplorerTypePage(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  typename: string;
}) {
  return (
    <>
      <Meta title={`Type ${props.typename}`} />
      <SchemaExplorerProvider>
        <TypeExplorerPageContent {...props} />
      </SchemaExplorerProvider>
    </>
  );
}
