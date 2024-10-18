import { ReactElement, useMemo, useRef } from 'react';
import { endOfDay, formatISO, startOfDay } from 'date-fns';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { Globe, History, MoveDownIcon, MoveUpIcon, SearchIcon } from 'lucide-react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useQuery } from 'urql';
import { z } from 'zod';
import { OrganizationLayout, Page } from '@/components/layouts/organization';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyList } from '@/components/ui/empty-list';
import { Input } from '@/components/ui/input';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FragmentType, graphql, useFragment } from '@/gql';
import { ProjectType } from '@/gql/graphql';
import { subDays } from '@/lib/date-time';
import { useFormattedNumber } from '@/lib/hooks';
import { pluralize } from '@/lib/utils';
import { UTCDate } from '@date-fns/utc';
import { Link, useRouter } from '@tanstack/react-router';

export const OrganizationIndexRouteSearch = z.object({
  search: z.string().optional(),
  sortBy: z.enum(['requests', 'versions', 'name']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

type RouteSearchProps = z.infer<typeof OrganizationIndexRouteSearch>;

const ProjectCard_ProjectFragment = graphql(`
  fragment ProjectCard_ProjectFragment on Project {
    id
    slug
    type
  }
`);

const projectTypeFullNames = {
  [ProjectType.Federation]: 'Apollo Federation',
  [ProjectType.Stitching]: 'Schema Stitching',
  [ProjectType.Single]: 'Monolithic Schema',
};

const ProjectCard = (props: {
  project: FragmentType<typeof ProjectCard_ProjectFragment> | null;
  cleanOrganizationId: string | null;
  highestNumberOfRequests: number;
  requestsOverTime: { date: string; value: number }[] | null;
  schemaVersionsCount: number | null;
  days: number;
}): ReactElement | null => {
  const project = useFragment(ProjectCard_ProjectFragment, props.project);

  const { highestNumberOfRequests } = props;

  const requests = useMemo(() => {
    if (props.requestsOverTime?.length) {
      return props.requestsOverTime.map<[string, number]>(node => [node.date, node.value]);
    }

    return [
      [new Date(subDays(new Date(), props.days)).toISOString(), 0],
      [new Date().toISOString(), 0],
    ] as [string, number][];
  }, [props.requestsOverTime]);

  const totalNumberOfRequests = useMemo(
    () => requests.reduce((acc, [_, value]) => acc + value, 0),
    [requests],
  );
  const totalNumberOfVersions = props.schemaVersionsCount ?? 0;

  const requestsInDateRange = useFormattedNumber(totalNumberOfRequests);
  const schemaVersionsInDateRange = useFormattedNumber(totalNumberOfVersions);

  return (
    <Card className="h-full self-start bg-gray-900/50 p-5 px-0 pt-4 hover:bg-gray-800/40 hover:shadow-md hover:shadow-gray-800/50">
      <Link
        to="/$organizationSlug/$projectSlug"
        params={{
          organizationSlug: props.cleanOrganizationId ?? 'unknown-yet',
          projectSlug: project?.slug ?? 'unknown-yet',
        }}
      >
        <TooltipProvider>
          <div className="flex items-start gap-x-2">
            <div className="grow">
              <div>
                <AutoSizer disableHeight>
                  {size => (
                    <ReactECharts
                      style={{ width: size.width, height: 90 }}
                      option={{
                        animation: !!project,
                        color: ['#f4b740'],
                        grid: {
                          left: 0,
                          top: 10,
                          right: 0,
                          bottom: 10,
                        },
                        tooltip: {
                          trigger: 'axis',
                          axisPointer: {
                            label: {
                              formatter({ value }: { value: number }) {
                                return new Date(value).toDateString();
                              },
                            },
                          },
                        },
                        xAxis: [
                          {
                            show: false,
                            type: 'time',
                            boundaryGap: false,
                          },
                        ],
                        yAxis: [
                          {
                            show: false,
                            type: 'value',
                            min: 0,
                            max: highestNumberOfRequests,
                          },
                        ],
                        series: [
                          {
                            name: 'Requests',
                            type: 'line',
                            smooth: false,
                            lineStyle: {
                              width: 2,
                            },
                            showSymbol: false,
                            areaStyle: {
                              opacity: 0.8,
                              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                {
                                  offset: 0,
                                  color: 'rgba(244, 184, 64, 0.20)',
                                },
                                {
                                  offset: 1,
                                  color: 'rgba(244, 184, 64, 0)',
                                },
                              ]),
                            },
                            emphasis: {
                              focus: 'series',
                            },
                            data: requests,
                          },
                        ],
                      }}
                    />
                  )}
                </AutoSizer>
              </div>
              <div className="flex flex-row items-center justify-between gap-y-3 px-4 pt-4">
                {project ? (
                  <div>
                    <h4 className="line-clamp-2 text-lg font-bold">{project.slug}</h4>
                    <p className="text-xs text-gray-300">{projectTypeFullNames[project.type]}</p>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 h-4 w-48 animate-pulse rounded-full bg-gray-800 py-2" />
                    <div className="h-2 w-24 animate-pulse rounded-full bg-gray-800" />
                  </div>
                )}
                <div className="flex flex-col gap-y-2 py-1">
                  {project ? (
                    <>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex flex-row items-center gap-x-2">
                            <Globe className="size-4 text-gray-500" />
                            <div className="text-xs">
                              {requestsInDateRange}{' '}
                              {pluralize(totalNumberOfRequests, 'request', 'requests')}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          Number of GraphQL requests in the last {props.days} days.
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex flex-row items-center gap-x-2">
                            <History className="size-4 text-gray-500" />
                            <div className="text-xs">
                              {schemaVersionsInDateRange}{' '}
                              {pluralize(totalNumberOfVersions, 'commit', 'commits')}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          Number of schemas pushed to this project in the last {props.days} days.
                        </TooltipContent>
                      </Tooltip>
                    </>
                  ) : (
                    <>
                      <div className="my-1 h-2 w-16 animate-pulse rounded-full bg-gray-800" />
                      <div className="my-1 h-2 w-16 animate-pulse rounded-full bg-gray-800" />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TooltipProvider>
      </Link>
    </Card>
  );
};

const OrganizationProjectsPageQuery = graphql(`
  query OrganizationProjectsPageQuery(
    $organizationSlug: String!
    $chartResolution: Int!
    $period: DateRangeInput!
  ) {
    organization(selector: { organizationSlug: $organizationSlug }) {
      organization {
        id
        slug
      }
    }
    projects(selector: { organizationSlug: $organizationSlug }) {
      total
      nodes {
        id
        slug
        ...ProjectCard_ProjectFragment
        totalRequests(period: $period)
        requestsOverTime(resolution: $chartResolution, period: $period) {
          date
          value
        }
        schemaVersionsCount(period: $period)
      }
    }
  }
`);

function OrganizationPageContent(
  props: {
    organizationSlug: string;
  } & RouteSearchProps,
) {
  const days = 14;
  const period = useRef<{
    from: string;
    to: string;
  }>();

  // Sort by requests by default
  const sortKey = props.sortBy ?? 'requests';

  const sortOrder =
    props.sortOrder === 'asc'
      ? -1
      : // if the sort order is not set, sort by name in ascending order by default
        !props.sortOrder && props.sortBy === 'name'
        ? -1
        : // if the sort order is not set, sort in descending order by default
          1;

  if (!period.current) {
    const now = new UTCDate();
    const from = formatISO(startOfDay(subDays(now, days)));
    const to = formatISO(endOfDay(now));

    period.current = { from, to };
  }

  const router = useRouter();

  const [query] = useQuery({
    query: OrganizationProjectsPageQuery,
    variables: {
      organizationSlug: props.organizationSlug,
      chartResolution: days, // 14 days = 14 data points
      period: period.current,
    },
    requestPolicy: 'cache-and-network',
  });

  const currentOrganization = query.data?.organization?.organization;
  const projectsConnection = query.data?.projects;

  const highestNumberOfRequests = useMemo(() => {
    let highest = 10;

    if (projectsConnection?.nodes.length) {
      for (const project of projectsConnection.nodes) {
        for (const dataPoint of project.requestsOverTime) {
          if (dataPoint.value > highest) {
            highest = dataPoint.value;
          }
        }
      }
    }

    return highest;
  }, [projectsConnection]);

  const projects = useMemo(() => {
    if (!projectsConnection) {
      return [];
    }

    const searchPhrase = props.search;
    const newProjects = searchPhrase
      ? projectsConnection.nodes.filter(project =>
          project.slug.toLowerCase().includes(searchPhrase.toLowerCase()),
        )
      : projectsConnection.nodes.slice();

    return newProjects.sort((a, b) => {
      const diffRequests = b.totalRequests - a.totalRequests;
      const diffVersions = b.schemaVersionsCount - a.schemaVersionsCount;

      if (sortKey === 'requests' && diffRequests !== 0) {
        return diffRequests * sortOrder;
      }

      if (sortKey === 'versions' && diffVersions !== 0) {
        return diffVersions * sortOrder;
      }

      if (sortKey === 'name') {
        return a.slug.localeCompare(b.slug) * sortOrder * -1;
      }

      // falls back to sort by name in ascending order
      return a.slug.localeCompare(b.slug);
    });
  }, [projectsConnection, props.search, sortKey, sortOrder]);

  if (query.error) {
    return <QueryError organizationSlug={props.organizationSlug} error={query.error} />;
  }

  return (
    <OrganizationLayout
      page={Page.Overview}
      organizationSlug={props.organizationSlug}
      className="flex justify-between gap-12"
    >
      <>
        <div className="grow">
          <div className="flex flex-row items-center justify-between py-6">
            <div>
              <Title>Projects</Title>
              <Subtitle>A list of available project in your organization.</Subtitle>
            </div>
            <div>
              <div className="flex flex-row items-center gap-x-2">
                <div className="relative">
                  <SearchIcon className="text-muted-foreground absolute left-2.5 top-2.5 size-4" />
                  <Input
                    type="search"
                    placeholder="Search..."
                    value={props.search}
                    onChange={event => {
                      void router.navigate({
                        search(params) {
                          return {
                            ...params,
                            search: event.target.value,
                          };
                        },
                      });
                    }}
                    className="bg-background w-full rounded-lg pl-8 md:w-[200px] lg:w-[336px]"
                  />
                </div>
                <Separator orientation="vertical" className="mx-4 h-8" />
                <Select
                  value={props.sortBy ?? 'requests'}
                  onValueChange={value => {
                    void router.navigate({
                      search(params) {
                        return {
                          ...params,
                          sortBy: value,
                        };
                      },
                    });
                  }}
                >
                  <SelectTrigger className="hover:bg-accent bg-transparent">
                    {props.sortBy === 'versions'
                      ? 'Schema Versions'
                      : props.sortBy === 'name'
                        ? 'Name'
                        : 'Requests'}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requests">
                      <div className="font-bold">Requests</div>
                      <div className="text-muted-foreground text-xs">
                        GraphQL requests made in the last {days} days.
                      </div>
                    </SelectItem>
                    <SelectItem value="versions">
                      <div className="font-bold">Schema Versions</div>
                      <div className="text-muted-foreground text-xs">
                        Schemas published in last {days} days.
                      </div>
                    </SelectItem>
                    <SelectItem value="name">
                      <div className="font-bold">Name</div>
                      <div className="text-muted-foreground text-xs">Sort by project name.</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  className="shrink-0"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    void router.navigate({
                      search(params) {
                        return {
                          ...params,
                          sortOrder: props.sortOrder === 'asc' ? 'desc' : 'asc',
                        };
                      },
                    });
                  }}
                >
                  {props.sortOrder === 'asc' ? (
                    <MoveUpIcon className="size-4" />
                  ) : (
                    <MoveDownIcon className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          {currentOrganization && projectsConnection ? (
            projectsConnection.total === 0 ? (
              <EmptyList
                title="Hive is waiting for your first project"
                description='You can create a project by clicking the "Create Project" button'
                docsUrl="/management/projects#create-a-new-project"
              />
            ) : (
              <div className="grid grid-cols-2 items-stretch gap-5 xl:grid-cols-3">
                {projects.map(project => (
                  <ProjectCard
                    key={project.id}
                    cleanOrganizationId={currentOrganization.slug}
                    days={days}
                    highestNumberOfRequests={highestNumberOfRequests}
                    project={project}
                    requestsOverTime={project.requestsOverTime}
                    schemaVersionsCount={project.schemaVersionsCount}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 items-stretch gap-5 xl:grid-cols-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <ProjectCard
                  key={index}
                  days={days}
                  highestNumberOfRequests={highestNumberOfRequests}
                  project={null}
                  cleanOrganizationId={null}
                  requestsOverTime={null}
                  schemaVersionsCount={null}
                />
              ))}
            </div>
          )}
        </div>
      </>
    </OrganizationLayout>
  );
}

export function OrganizationPage(
  props: {
    organizationSlug: string;
  } & RouteSearchProps,
) {
  return (
    <>
      <Meta title="Organization" />
      <OrganizationPageContent
        organizationSlug={props.organizationSlug}
        search={props.search}
        sortBy={props.sortBy}
        sortOrder={props.sortOrder}
      />
    </>
  );
}
