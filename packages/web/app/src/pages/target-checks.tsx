import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useQuery } from 'urql';
import { LayoutContent } from '@/components/layouts/layout-content';
import { ServiceFilterButton } from '@/components/target/checks/service-filter-button';
import { DocsLink } from '@/components/ui/docs-note';
import { EmptyList, NoSchemaVersion } from '@/components/ui/empty-list';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { Button } from '@/components/ui/primitives/button/button';
import { Select } from '@/components/ui/primitives/floating/select/select';
import { Label } from '@/components/ui/primitives/label/label';
import { ScrollArea } from '@/components/ui/primitives/scroll-area/scroll-area';
import { Spinner } from '@/components/ui/primitives/spinner/spinner';
import { StatusDot } from '@/components/ui/primitives/status-dot/status-dot';
import { Switch } from '@/components/ui/primitives/switch/switch';
import { QueryError } from '@/components/ui/query-error';
import { TimeAgo } from '@/components/ui/time-ago';
import { graphql } from '@/gql';
import { ProjectType } from '@/gql/graphql';
import { useSlugs } from '@/lib/hooks';
import { useResetState } from '@/lib/hooks/use-reset-state';
import { cn } from '@/lib/utils';
import { getRouteApi, Link, Outlet, useParams, useRouter } from '@tanstack/react-router';

const checksRoute = getRouteApi(
  '/authenticated/with-header/$organizationSlug/$projectSlug/$targetSlug/checks',
);

export const SchemaChecks_NavigationQuery = graphql(`
  query SchemaChecks_NavigationQuery(
    $organizationSlug: String!
    $projectSlug: String!
    $targetSlug: String!
    $after: String
    $filters: SchemaChecksFilter
  ) {
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
  showOnlyFailed: boolean;
  showOnlyChanged: boolean;
  serviceName: string | null;
}

// The cache merges the pages of `Target.schemaChecks` (relayPagination), so the query for the
// latest cursor reads every page loaded so far.
function SchemaChecksList(props: { schemaCheckId?: string } & SchemaCheckFilters) {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const [after, setAfter] = useResetState<string | null>(null, [
    props.showOnlyChanged,
    props.showOnlyFailed,
    props.serviceName,
  ]);
  const search = useMemo(() => {
    return {
      filter_changed: props.showOnlyChanged,
      filter_failed: props.showOnlyFailed,
      filter_service: props.serviceName ?? undefined,
    };
  }, [props.showOnlyChanged, props.showOnlyFailed, props.serviceName]);
  const [query] = useQuery({
    query: SchemaChecks_NavigationQuery,
    variables: {
      organizationSlug,
      projectSlug,
      targetSlug,
      after,
      filters: {
        changed: props.showOnlyChanged,
        failed: props.showOnlyFailed,
        serviceName: props.serviceName,
      },
    },
  });

  const schemaChecks = query.data?.target?.schemaChecks;
  if (!schemaChecks) {
    return query.fetching ? (
      <div className="mt-4 flex w-full grow flex-col items-center">
        <Spinner />
      </div>
    ) : null;
  }

  if (schemaChecks.edges.length === 0) {
    return (
      <div className="my-4 cursor-default text-center text-sm text-fg-secondary">
        No schema checks found with the current filters
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-[300px] grow flex-col rounded-md border border-line-subtle">
      <ScrollArea fill>
        <div className="flex flex-col gap-2.5 p-2.5">
          {schemaChecks.edges.map(edge => (
            <div
              key={edge.node.id}
              className={cn(
                'relative flex flex-col rounded-md p-2.5 hover:bg-surface-hover',
                edge.node.id === props.schemaCheckId ? 'bg-surface-selected' : null,
              )}
            >
              {/* A pointer moving down the list would run a loader per row it crossed. */}
              {/* The overlay keeps the whole row clickable while the service name and the commit
                  link below stay interactive on their own, above it. */}
              <Link
                to="/$organizationSlug/$projectSlug/$targetSlug/checks/$schemaCheckId"
                preload={false}
                params={{ organizationSlug, projectSlug, targetSlug, schemaCheckId: edge.node.id }}
                search={search}
                className="after:absolute after:inset-0 after:content-['']"
              >
                <h3 className="truncate text-sm font-semibold">
                  {edge.node.meta?.commit ?? edge.node.id}
                </h3>
                {edge.node.meta?.author ? (
                  <div className="truncate text-xs font-medium text-fg-secondary">
                    <span className="truncate overflow-hidden">{edge.node.meta.author}</span>
                  </div>
                ) : null}
              </Link>
              <div className="mt-2.5 mb-1.5 flex align-middle text-xs font-medium text-fg-secondary">
                <div
                  className={cn(
                    edge.node.__typename === 'FailedSchemaCheck' ? 'text-critical' : null,
                    'flex flex-row items-center gap-1',
                  )}
                >
                  <StatusDot
                    color={edge.node.__typename === 'FailedSchemaCheck' ? 'critical' : 'success'}
                    label={edge.node.__typename === 'FailedSchemaCheck' ? 'Failed' : 'Passed'}
                  />
                  <TimeAgo date={edge.node.createdAt} />
                </div>

                {edge.node.serviceName ? (
                  <ServiceFilterButton
                    serviceName={edge.node.serviceName}
                    className="relative z-10 ml-auto w-1/2 text-right font-bold"
                  />
                ) : null}
              </div>
              {edge.node.githubRepository && edge.node.meta ? (
                <a
                  className="relative z-10 -ml-px text-xs font-medium text-fg-secondary hover:text-fg-secondary"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://github.com/${edge.node.githubRepository}/commit/${edge.node.meta.commit}`}
                >
                  <ExternalLink className="inline size-4" /> associated with Git commit
                </a>
              ) : null}
            </div>
          ))}
          {schemaChecks.pageInfo.hasNextPage && (
            <Button
              variant="link"
              disabled={query.stale}
              onClick={() => setAfter(schemaChecks.pageInfo.endCursor ?? null)}
            >
              Load more
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export const ChecksPageQuery = graphql(`
  query ChecksPageQuery($organizationSlug: String!, $projectSlug: String!, $targetSlug: String!) {
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
      project {
        id
        type
      }
      schemaCheckServiceNames
      # Whether any check exists; the list itself says whether the current filters match one.
      schemaChecks(first: 1) {
        edges {
          node {
            id
          }
        }
      }
    }
  }
`);

function useTargetCheckUrlParams() {
  const { schemaCheckId } = useParams({
    strict: false /* allows to read the $schemaCheckId param of its child route */,
  }) as { schemaCheckId?: string };
  const search = checksRoute.useSearch() as {
    filter_changed?: boolean;
    filter_failed?: boolean;
    filter_service?: string;
  };
  return {
    showOnlyChanged: search.filter_changed ?? false,
    showOnlyFailed: search.filter_failed ?? false,
    serviceName: search.filter_service ?? null,
    schemaCheckId,
    rawSearch: search,
  };
}

function ChecksPageContent() {
  const { organizationSlug, projectSlug, targetSlug } = useSlugs('target');
  const { showOnlyChanged, showOnlyFailed, serviceName, schemaCheckId } = useTargetCheckUrlParams();

  const [query] = useQuery({
    query: ChecksPageQuery,
    variables: { organizationSlug, projectSlug, targetSlug },
  });

  const isLoading = query.fetching || query.stale;
  const renderLoading = useDebouncedLoader(isLoading);
  const target = query.data?.target;
  const hasSchemaChecks = !!target?.schemaChecks.edges.length;
  const hasActiveSchemaCheck = !!schemaCheckId;
  // Null (single-schema, no service names) hides the filter.
  const serviceNames = target?.schemaCheckServiceNames ?? null;

  if (query.error) {
    return (
      <QueryError
        organizationSlug={organizationSlug}
        error={query.error}
        showLogoutButton={false}
      />
    );
  }

  return (
    <>
      <div className={cn(!hasSchemaChecks && 'w-full')}>
        <div className="w-[300px] py-6">
          <Title>Schema Checks</Title>
          <Subtitle>Recently checked schemas.</Subtitle>
        </div>
        {hasSchemaChecks && (
          <SchemaChecksSideNav serviceNames={serviceNames}>
            <SchemaChecksList
              schemaCheckId={schemaCheckId}
              showOnlyChanged={showOnlyChanged}
              showOnlyFailed={showOnlyFailed}
              serviceName={serviceName}
            />
          </SchemaChecksSideNav>
        )}
        {!hasSchemaChecks && !isLoading && (
          <NoSchemaChecks projectType={target?.project.type ?? null} />
        )}
        {renderLoading && (
          <div className="mt-4 flex w-full grow flex-col items-center">
            <Spinner />
          </div>
        )}
      </div>
      {hasSchemaChecks && <Outlet />}
      {hasSchemaChecks && !hasActiveSchemaCheck && (
        <div className="my-4 mt-6 w-full border-0 py-8">
          <EmptyList
            title="Select a schema check"
            description="A list of your schema checks is available on the left."
          />
        </div>
      )}
    </>
  );
}

function NoSchemaChecks(props: { projectType: ProjectType | null }) {
  return (
    <>
      <div className="cursor-default text-sm">
        <NoSchemaVersion projectType={props.projectType} recommendedAction="check" />
      </div>
      <DocsLink
        href="/features/schema-registry#check-a-schema"
        text="Learn how to check your first schema"
      />
    </>
  );
}

/**
 * Renders the section of the checks page for when there are checks existing in the backend
 */
function SchemaChecksSideNav(props: {
  children: ReactNode;
  /** `null` hides the service filter: single-schema checks have no service. */
  serviceNames: readonly string[] | null;
}) {
  const router = useRouter();
  const { showOnlyChanged, showOnlyFailed, serviceName, rawSearch } = useTargetCheckUrlParams();

  // Relative to the current URL, so a selected check stays selected.
  const setFilters = (filters: Partial<typeof rawSearch>) =>
    void router.navigate({ to: '.', search: { ...rawSearch, ...filters }, replace: true });

  const handleShowOnlyFilterChange = () => setFilters({ filter_changed: !showOnlyChanged });
  const handleShowOnlyFilterFailed = () => setFilters({ filter_failed: !showOnlyFailed });
  const handleServiceChange = (value: string) => setFilters({ filter_service: value || undefined });

  const serviceOptions = useMemo(() => {
    if (!props.serviceNames) {
      return [];
    }
    // A name set from a check or typed into the URL may not be in the latest valid version yet.
    const names =
      serviceName && !props.serviceNames.includes(serviceName)
        ? [...props.serviceNames, serviceName]
        : props.serviceNames;
    return [
      { value: '', label: 'All services' },
      ...names.map(name => ({ value: name, label: name })),
    ];
  }, [props.serviceNames, serviceName]);

  return (
    // Pinned and capped to the viewport, so the list scrolls inside the column rather than
    // stretching the page when there are more checks than fit.
    <div className="sticky top-6 flex max-h-[calc(100vh-3rem)] flex-col gap-5 self-start">
      <div>
        {props.serviceNames ? (
          <div className="flex h-9 flex-row items-center justify-between">
            <Label variant="inline" htmlFor="filter-service" label="Service" />
            <Select
              id="filter-service"
              matchTriggerWidth
              onValueChange={handleServiceChange}
              options={serviceOptions}
              searchable
              searchPlaceholder="Search service..."
              size="compact"
              value={serviceName ?? ''}
              width="md"
            />
          </div>
        ) : null}
        <div className="flex h-9 flex-row items-center justify-between">
          <Label
            variant="inline"
            htmlFor="filter-toggle-has-changes"
            label="Show only changed schemas"
          />
          <Switch
            checked={showOnlyChanged}
            onCheckedChange={handleShowOnlyFilterChange}
            id="filter-toggle-has-changes"
          />
        </div>
        <div className="flex h-9 flex-row items-center justify-between">
          <Label
            variant="inline"
            htmlFor="filter-toggle-status-failed"
            label="Show only failed checks"
          />
          <Switch
            checked={showOnlyFailed}
            onCheckedChange={handleShowOnlyFilterFailed}
            id="filter-toggle-status-failed"
          />
        </div>
      </div>
      {props.children}
    </div>
  );
}

export function TargetChecksPage() {
  return (
    <>
      <Meta title="Schema Checks" />
      <LayoutContent className="flex flex-row gap-x-6">
        <ChecksPageContent />
      </LayoutContent>
    </>
  );
}

const useDebouncedLoader = (isLoading: boolean, delay = 500): boolean => {
  const [showLoadingIcon, setShowLoadingIcon] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (isLoading) {
      // Start a timer to show the loading icon after the delay
      timerRef.current = setTimeout(() => {
        setShowLoadingIcon(true);
      }, delay);
    } else {
      // If loading finishes, clear any pending timer and hide the icon
      clearTimeout(timerRef.current);
      setShowLoadingIcon(false);
    }

    // Cleanup function to clear the timer on unmount or if isLoading changes
    return () => {
      clearTimeout(timerRef.current);
    };
  }, [isLoading, delay]);

  return showLoadingIcon;
};
