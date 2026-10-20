import { ReactNode } from 'react';
import { useQuery } from 'urql';
import { LayoutContent } from '@/components/layouts/layout-content';
import {
  ExplorerFilteredEmptyState,
  GraphQLFieldsSkeleton,
  GraphQLTypeCardSkeleton,
} from '@/components/target/explorer/common';
import { GraphQLEnumTypeComponent } from '@/components/target/explorer/enum-type';
import { ExplorerHeader } from '@/components/target/explorer/explorer-header';
import { DateRangeFilter } from '@/components/target/explorer/filter';
import { GraphQLInputObjectTypeComponent } from '@/components/target/explorer/input-object-type';
import { GraphQLInterfaceTypeComponent } from '@/components/target/explorer/interface-type';
import { GraphQLObjectTypeComponent } from '@/components/target/explorer/object-type';
import {
  SchemaExplorerProvider,
  useSchemaExplorerContext,
} from '@/components/target/explorer/provider';
import { GraphQLScalarTypeComponent } from '@/components/target/explorer/scalar-type';
import { GraphQLUnionTypeComponent } from '@/components/target/explorer/union-type';
import { matchesSubgraphFilter } from '@/components/target/explorer/utils';
import { presetLast7Days } from '@/components/ui/date-range-picker';
import { EmptyList, NoSchemaVersion } from '@/components/ui/empty-list';
import { Meta } from '@/components/ui/meta';
import { Button } from '@/components/ui/primitives/button/button';
import { QueryError } from '@/components/ui/query-error';
import { FragmentType, graphql, useFragment } from '@/gql';
import { useLayoutQuery, useSlugs } from '@/lib/hooks';
import { carriedRange, useDateRangeController } from '@/lib/hooks/use-date-range-controller';
import { getRouteApi, Link } from '@tanstack/react-router';

export const TypeRenderFragment = graphql(`
  fragment TypeRenderFragment on GraphQLNamedType {
    __typename
    supergraphMetadata {
      ownedByServiceNames
    }
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
  warnAboutUnusedArguments: boolean;
  warnAboutDeprecatedArguments: boolean;
  filteredFallback?: ReactNode;
}) {
  const ttype = useFragment(TypeRenderFragment, props.type);
  const { subgraphs } = useSchemaExplorerContext();

  if (!matchesSubgraphFilter(ttype.supergraphMetadata?.ownedByServiceNames, subgraphs)) {
    return props.filteredFallback ?? null;
  }

  switch (ttype.__typename) {
    case 'GraphQLObjectType':
      return (
        <GraphQLObjectTypeComponent
          type={ttype}
          totalRequests={props.totalRequests}
          warnAboutUnusedArguments={props.warnAboutUnusedArguments}
          warnAboutDeprecatedArguments={props.warnAboutDeprecatedArguments}
        />
      );
    case 'GraphQLInterfaceType':
      return (
        <GraphQLInterfaceTypeComponent
          type={ttype}
          totalRequests={props.totalRequests}
          warnAboutUnusedArguments={props.warnAboutUnusedArguments}
          warnAboutDeprecatedArguments={props.warnAboutDeprecatedArguments}
        />
      );
    case 'GraphQLUnionType':
      return <GraphQLUnionTypeComponent type={ttype} totalRequests={props.totalRequests} />;
    case 'GraphQLEnumType':
      return <GraphQLEnumTypeComponent type={ttype} totalRequests={props.totalRequests} />;
    case 'GraphQLInputObjectType':
      return <GraphQLInputObjectTypeComponent type={ttype} totalRequests={props.totalRequests} />;
    case 'GraphQLScalarType':
      return <GraphQLScalarTypeComponent type={ttype} totalRequests={props.totalRequests} />;
    default:
      return <div>Unknown type: {(ttype as any).__typename}</div>;
  }
}

const typeRoute = getRouteApi(
  '/authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/explorer/$typename',
);

export const TargetExplorerTypenamePageQuery = graphql(`
  query TargetExplorerTypenamePageQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
    $period: DateRangeInput!
    $typename: String!
  ) {
    organization: organizationBySlug(organizationSlug: $organizationSlug) {
      id
      slug
      usageRetentionInDays
    }
    target(
      reference: {
        bySelector: {
          organizationSlug: $organizationSlug
          projectSlug: $projectSlug
          targetSlug: $targetSlug
        }
      }
    ) {
      id
      slug
      latestSchemaVersion {
        __typename
        id
        explorer(usage: { period: $period }) {
          subgraphNames
          metadataAttributes {
            name
            values
          }
          type(name: $typename) {
            ...TypeRenderFragment
          }
        }
      }
      project {
        id
        type
      }
      operationsStats(period: $period) {
        totalRequests
      }
    }
  }
`);

function TypeExplorerPageContent(props: { typename: string }) {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const dataRetentionInDays =
    useLayoutQuery('target').data?.organization?.usageRetentionInDays ?? 7;
  const dateRangeController = useDateRangeController({
    dataRetentionInDays,
    defaultPreset: presetLast7Days,
  });
  // Resolved by the route loader, so the page and the loader ask for one period.
  const { period } = typeRoute.useLoaderData();
  const search = typeRoute.useSearch();
  const [query] = useQuery({
    query: TargetExplorerTypenamePageQuery,
    variables: { organizationSlug, projectSlug, targetSlug, period, typename: props.typename },
  });

  if (query.error) {
    return (
      <QueryError
        organizationSlug={organizationSlug}
        error={query.error}
        showLogoutButton={false}
      />
    );
  }

  const currentTarget = query.data?.target;
  const type = currentTarget?.latestSchemaVersion?.explorer?.type;
  const latestSchemaVersion = currentTarget?.latestSchemaVersion;

  return (
    <>
      <ExplorerHeader
        title="Explore"
        description="Insights from the latest version."
        period={period}
        typename={props.typename}
        includeSchemaDimensions
        showFilters={!!(latestSchemaVersion && type)}
        subgraphNames={latestSchemaVersion?.explorer?.subgraphNames}
        metadataAttributes={latestSchemaVersion?.explorer?.metadataAttributes}
        dateRangeControl={<DateRangeFilter controller={dateRangeController} />}
      />
      {query.fetching || query.stale ? (
        <GraphQLTypeCardSkeleton>
          <GraphQLFieldsSkeleton count={15} />
        </GraphQLTypeCardSkeleton>
      ) : latestSchemaVersion && type ? (
        <TypeRenderer
          totalRequests={query.data?.target?.operationsStats.totalRequests ?? 0}
          type={type}
          warnAboutDeprecatedArguments={false}
          warnAboutUnusedArguments={false}
          filteredFallback={<ExplorerFilteredEmptyState />}
        />
      ) : latestSchemaVersion ? (
        // A mistyped URL lands here too, so this can't say the type was removed.
        <EmptyList
          title={`Type '${props.typename}' not found`}
          description="There's no type with this name in the latest version."
        >
          <Button
            variant="outline"
            render={
              <Link
                to="/$organizationSlug/$projectSlug/$targetSlug/explorer"
                params={{ organizationSlug, projectSlug, targetSlug }}
                search={carriedRange(search)}
              />
            }
          >
            Browse all types
          </Button>
        </EmptyList>
      ) : (
        <NoSchemaVersion
          recommendedAction="publish"
          projectType={query.data?.target?.project?.type ?? null}
        />
      )}
    </>
  );
}

export function TargetExplorerTypePage(props: { typename: string }) {
  return (
    <>
      <Meta title={`Type ${props.typename}`} />
      <SchemaExplorerProvider>
        <LayoutContent>
          <TypeExplorerPageContent {...props} />
        </LayoutContent>
      </SchemaExplorerProvider>
    </>
  );
}
