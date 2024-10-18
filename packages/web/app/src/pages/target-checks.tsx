import { useState } from 'react';
import { useQuery } from 'urql';
import { Page, TargetLayout } from '@/components/layouts/target';
import { BadgeRounded } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DocsLink } from '@/components/ui/docs-note';
import { EmptyList } from '@/components/ui/empty-list';
import { Label } from '@/components/ui/label';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { Switch } from '@/components/ui/switch';
import { TimeAgo } from '@/components/ui/time-ago';
import { graphql } from '@/gql';
import { cn } from '@/lib/utils';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Outlet, Link as RouterLink, useParams, useRouter } from '@tanstack/react-router';

const SchemaChecks_NavigationQuery = graphql(`
  query SchemaChecks_NavigationQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
    $after: String
    $filters: SchemaChecksFilter
  ) {
    target(
      selector: {
        organizationSlug: $organizationSlug
        projectSlug: $projectSlug
        targetSlug: $targetSlug
      }
    ) {
      id
      schemaChecks(first: 20, after: $after, filters: $filters) {
        edges {
          node {
            __typename
            id
            createdAt
            serviceName
            meta {
              commit
              author
            }
            breakingSchemaChanges {
              total
            }
            safeSchemaChanges {
              total
            }
            githubRepository
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          endCursor
        }
      }
    }
  }
`);

interface SchemaCheckFilters {
  showOnlyFailed?: boolean;
  showOnlyChanged?: boolean;
}

const Navigation = (props: {
  after: string | null;
  isLastPage: boolean;
  onLoadMore: (cursor: string) => void;
  filters?: SchemaCheckFilters;
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
  schemaCheckId?: string;
}) => {
  const [query] = useQuery({
    query: SchemaChecks_NavigationQuery,
    variables: {
      organizationSlug: props.organizationSlug,
      projectSlug: props.projectSlug,
      targetSlug: props.targetSlug,
      after: props.after,
      filters: {
        changed: props.filters?.showOnlyChanged ?? false,
        failed: props.filters?.showOnlyFailed ?? false,
      },
    },
  });

  return (
    <>
      {query.fetching || !query.data?.target?.schemaChecks ? null : (
        <>
          {query.data.target.schemaChecks.edges.map(edge => (
            <div
              key={edge.node.id}
              className={cn(
                'flex flex-col rounded-md p-2.5 hover:bg-gray-800/40',
                edge.node.id === props.schemaCheckId ? 'bg-gray-800/40' : null,
              )}
            >
              <RouterLink
                key={edge.node.id}
                to="/$organizationSlug/$projectSlug/$targetSlug/checks/$schemaCheckId"
                params={{
                  organizationSlug: props.organizationSlug,
                  projectSlug: props.projectSlug,
                  targetSlug: props.targetSlug,
                  schemaCheckId: edge.node.id,
                }}
                search={{
                  filter_changed: props.filters?.showOnlyChanged,
                  filter_failed: props.filters?.showOnlyFailed,
                }}
              >
                <h3 className="truncate text-sm font-semibold">
                  {edge.node.meta?.commit ?? edge.node.id}
                </h3>
                {edge.node.meta?.author ? (
                  <div className="truncate text-xs font-medium text-gray-500">
                    <span className="overflow-hidden truncate">{edge.node.meta.author}</span>
                  </div>
                ) : null}
                <div className="mb-1.5 mt-2.5 flex align-middle text-xs font-medium text-[#c4c4c4]">
                  <div
                    className={cn(
                      edge.node.__typename === 'FailedSchemaCheck' ? 'text-red-500' : null,
                      'flex flex-row items-center gap-1',
                    )}
                  >
                    <BadgeRounded
                      color={edge.node.__typename === 'FailedSchemaCheck' ? 'red' : 'green'}
                    />
                    <TimeAgo date={edge.node.createdAt} />
                  </div>

                  {edge.node.serviceName ? (
                    <div className="ml-auto mr-0 w-1/2 truncate text-right font-bold">
                      {edge.node.serviceName}
                    </div>
                  ) : null}
                </div>
              </RouterLink>
              {edge.node.githubRepository && edge.node.meta ? (
                <a
                  className="-ml-px text-xs font-medium text-gray-500 hover:text-gray-400"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://github.com/${edge.node.githubRepository}/commit/${edge.node.meta.commit}`}
                >
                  <ExternalLinkIcon className="inline" /> associated with Git commit
                </a>
              ) : null}
            </div>
          ))}
          {props.isLastPage && query.data.target.schemaChecks.pageInfo.hasNextPage && (
            <Button
              variant="orangeLink"
              onClick={() => {
                props.onLoadMore(query.data?.target?.schemaChecks.pageInfo.endCursor ?? '');
              }}
            >
              Load more
            </Button>
          )}
        </>
      )}
    </>
  );
};

const ChecksPageQuery = graphql(`
  query ChecksPageQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
    $filters: SchemaChecksFilter
  ) {
    organization(selector: { organizationSlug: $organizationSlug }) {
      organization {
        id
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
      schemaChecks(first: 1) {
        edges {
          node {
            id
          }
        }
      }
      filteredSchemaChecks: schemaChecks(first: 1, filters: $filters) {
        edges {
          node {
            id
          }
        }
      }
    }
  }
`);

function ChecksPageContent(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  const [paginationVariables, setPaginationVariables] = useState<Array<string | null>>(() => [
    null,
  ]);

  const router = useRouter();
  const { schemaCheckId } = useParams({
    strict: false /* allows to read the $schemaCheckId param of its child route */,
  }) as { schemaCheckId?: string };
  const search = router.latestLocation.search as {
    filter_changed?: string;
    filter_failed?: string;
  };
  const showOnlyChanged = search?.filter_changed === 'true';
  const showOnlyFailed = search?.filter_failed === 'true';

  const [filters, setFilters] = useState<SchemaCheckFilters>({
    showOnlyChanged: showOnlyChanged ?? false,
    showOnlyFailed: showOnlyFailed ?? false,
  });

  const [query] = useQuery({
    query: ChecksPageQuery,
    variables: {
      organizationSlug: props.organizationSlug,
      projectSlug: props.projectSlug,
      targetSlug: props.targetSlug,
      filters: {
        changed: filters.showOnlyChanged ?? false,
        failed: filters.showOnlyFailed ?? false,
      },
    },
  });

  if (query.error) {
    return <QueryError organizationSlug={props.organizationSlug} error={query.error} />;
  }

  const hasSchemaChecks = !!query.data?.target?.schemaChecks?.edges?.length;
  const hasFilteredSchemaChecks = !!query.data?.target?.filteredSchemaChecks?.edges?.length;
  const hasActiveSchemaCheck = !!schemaCheckId;

  const handleShowOnlyFilterChange = () => {
    const updatedFilters = !filters.showOnlyChanged;

    void router.navigate({
      search: {
        ...search,
        filter_changed: updatedFilters,
      },
    });
    setFilters(filters => ({
      ...filters,
      showOnlyChanged: !filters.showOnlyChanged,
    }));
  };

  const handleShowOnlyFilterFailed = () => {
    const updatedFilters = !filters.showOnlyFailed;

    void router.navigate({
      search: {
        ...search,
        filter_failed: updatedFilters,
      },
    });

    setFilters(filters => ({
      ...filters,
      showOnlyFailed: !filters.showOnlyFailed,
    }));
  };

  return (
    <>
      <TargetLayout
        organizationSlug={props.organizationSlug}
        projectSlug={props.projectSlug}
        targetSlug={props.targetSlug}
        page={Page.Checks}
        className={cn('flex', hasSchemaChecks || hasActiveSchemaCheck ? 'flex-row gap-x-6' : '')}
      >
        <div>
          <div className="w-[300px] py-6">
            <Title>Schema Checks</Title>
            <Subtitle>Recently checked schemas.</Subtitle>
          </div>
          {query.fetching || query.stale ? null : hasSchemaChecks ? (
            <div className="flex flex-col gap-5">
              <div>
                <div className="flex h-9 flex-row items-center justify-between">
                  <Label
                    htmlFor="filter-toggle-has-changes"
                    className="text-sm font-normal text-gray-100"
                  >
                    Show only changed schemas
                  </Label>
                  <Switch
                    checked={filters.showOnlyChanged ?? false}
                    onCheckedChange={handleShowOnlyFilterChange}
                    id="filter-toggle-has-changes"
                  />
                </div>
                <div className="flex h-9 flex-row items-center justify-between">
                  <Label
                    htmlFor="filter-toggle-status-failed"
                    className="text-sm font-normal text-gray-100"
                  >
                    Show only failed checks
                  </Label>
                  <Switch
                    checked={filters.showOnlyFailed ?? false}
                    onCheckedChange={handleShowOnlyFilterFailed}
                    id="filter-toggle-status-failed"
                  />
                </div>
              </div>
              {hasFilteredSchemaChecks ? (
                <div className="flex w-[300px] grow flex-col gap-2.5 overflow-y-auto rounded-md border border-gray-800/50 p-2.5">
                  {paginationVariables.map((cursor, index) => (
                    <Navigation
                      organizationSlug={props.organizationSlug}
                      projectSlug={props.projectSlug}
                      targetSlug={props.targetSlug}
                      schemaCheckId={schemaCheckId}
                      after={cursor}
                      isLastPage={index + 1 === paginationVariables.length}
                      onLoadMore={cursor => setPaginationVariables(cursors => [...cursors, cursor])}
                      key={cursor ?? 'first'}
                      filters={filters}
                    />
                  ))}
                </div>
              ) : (
                <div className="cursor-default text-sm">
                  No schema checks found with the current filters
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="cursor-default text-sm">
                {hasActiveSchemaCheck ? 'List is empty' : 'Your schema check list is empty'}
              </div>
              <DocsLink href="/features/schema-registry#check-a-schema">
                {hasActiveSchemaCheck
                  ? 'Check you first schema'
                  : 'Learn how to check your first schema with Hive CLI'}
              </DocsLink>
            </div>
          )}
        </div>

        {hasActiveSchemaCheck ? (
          schemaCheckId ? (
            <Outlet />
          ) : null
        ) : hasSchemaChecks ? (
          <EmptyList
            className="my-4 mt-6 justify-center border-0 py-8"
            title="Select a schema check"
            description="A list of your schema checks is available on the left."
          />
        ) : null}
      </TargetLayout>
    </>
  );
}

export function TargetChecksPage(props: {
  organizationSlug: string;
  projectSlug: string;
  targetSlug: string;
}) {
  return (
    <>
      <Meta title="Schema Checks" />
      <ChecksPageContent {...props} />
    </>
  );
}
