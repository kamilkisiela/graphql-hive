import { ReactElement, useMemo, useRef } from 'react';
import { endOfDay, formatISO, startOfDay } from 'date-fns';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import { Globe, History } from 'lucide-react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useQuery } from 'urql';
import { Page, ProjectLayout } from '@/components/layouts/project';
import { Activities } from '@/components/ui/activities';
import { EmptyList } from '@/components/ui/empty-list';
import { Meta } from '@/components/ui/meta';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card } from '@/components/v2/card';
import { FragmentType, graphql, useFragment } from '@/gql';
import { subDays } from '@/lib/date-time';
import { useFormattedNumber } from '@/lib/hooks';
import { cn, pluralize } from '@/lib/utils';
import { UTCDate } from '@date-fns/utc';
import { Link } from '@tanstack/react-router';

const TargetCard_TargetFragment = graphql(`
  fragment TargetCard_TargetFragment on Target {
    id
    name
    cleanId
  }
`);

const TargetCard = (props: {
  target: FragmentType<typeof TargetCard_TargetFragment> | null;
  highestNumberOfRequests: number;
  requestsOverTime: { date: string; value: number }[] | null;
  schemaVersionsCount: number | null;
  days: number;
  organizationId: string;
  projectId: string;
}): ReactElement => {
  const target = useFragment(TargetCard_TargetFragment, props.target);
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
    <Card
      asChild
      className="h-full self-start bg-gray-900/50 px-0 pt-4 hover:bg-gray-800/40 hover:shadow-md hover:shadow-gray-800/50"
    >
      <Link
        to="/$organizationId/$projectId/$targetId"
        params={{
          organizationId: props.organizationId ?? 'unknown-yet',
          projectId: props.projectId ?? 'unknown-yet',
          targetId: target?.cleanId ?? 'unknown-yet',
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
                        animation: !!target,
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
                <div>
                  {target ? (
                    <h4 className="line-clamp-2 text-lg font-bold">{target.name}</h4>
                  ) : (
                    <div className="h-4 w-48 animate-pulse rounded-full bg-gray-800 py-2" />
                  )}
                </div>
                <div className="flex flex-col gap-y-2 py-1">
                  {target ? (
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

const ProjectsPageContent = (props: { organizationId: string; projectId: string }) => {
  const period = useRef<{
    from: string;
    to: string;
  }>();
  const days = 14;

  if (!period.current) {
    const now = new UTCDate();
    const from = formatISO(startOfDay(subDays(now, days)));
    const to = formatISO(endOfDay(now));

    period.current = { from, to };
  }

  const [query] = useQuery({
    query: ProjectOverviewPageQuery,
    variables: {
      organizationId: props.organizationId,
      projectId: props.projectId,
      chartResolution: days, // 14 days = 14 data points
      period: period.current,
    },
    requestPolicy: 'cache-and-network',
  });

  const targetConnection = query.data?.targets;
  const targets = targetConnection?.nodes;

  const highestNumberOfRequests = useMemo(() => {
    if (targets?.length) {
      return targets.reduce((max, target) => {
        return Math.max(
          max,
          target.requestsOverTime.reduce((max, { value }) => Math.max(max, value), 0),
        );
      }, 100);
    }

    return 100;
  }, [targets]);

  if (query.error) {
    return <QueryError organizationId={props.organizationId} error={query.error} />;
  }

  return (
    <ProjectLayout
      page={Page.Targets}
      organizationId={props.organizationId}
      projectId={props.projectId}
      className="flex justify-between gap-12"
    >
      <div className="grow">
        <div className="py-6">
          <Title>Targets</Title>
          <Subtitle>A list of available targets in your project.</Subtitle>
        </div>
        <div
          className={cn(
            'grow',
            targets?.length === 0 ? '' : 'grid grid-cols-2 items-stretch gap-5',
          )}
        >
          {targets ? (
            targets.length === 0 ? (
              <EmptyList
                title="Hive is waiting for your first target"
                description='You can create a target by clicking the "New Target" button'
                docsUrl="/management/targets#create-a-new-target"
              />
            ) : (
              targets
                .sort((a, b) => {
                  const diffOperations = b.totalRequests - a.totalRequests;
                  if (diffOperations !== 0) {
                    return diffOperations;
                  }

                  const diffVersions = b.schemaVersionsCount - a.schemaVersionsCount;
                  if (diffVersions !== 0) {
                    return diffVersions;
                  }

                  return a.name.localeCompare(b.name);
                })
                .map(target => (
                  <TargetCard
                    key={target.id}
                    target={target}
                    days={days}
                    highestNumberOfRequests={highestNumberOfRequests}
                    requestsOverTime={target.requestsOverTime}
                    schemaVersionsCount={target.schemaVersionsCount}
                    organizationId={props.organizationId}
                    projectId={props.projectId}
                  />
                ))
            )
          ) : (
            <>
              {Array.from({ length: 4 }).map((_, index) => (
                <TargetCard
                  key={index}
                  target={null}
                  days={days}
                  highestNumberOfRequests={highestNumberOfRequests}
                  requestsOverTime={null}
                  schemaVersionsCount={null}
                  organizationId={props.organizationId}
                  projectId={props.projectId}
                />
              ))}
            </>
          )}
        </div>
      </div>
      <Activities organizationId={props.organizationId} />
    </ProjectLayout>
  );
};

const ProjectOverviewPageQuery = graphql(`
  query ProjectOverviewPageQuery(
    $organizationId: ID!
    $projectId: ID!
    $chartResolution: Int!
    $period: DateRangeInput!
  ) {
    targets(selector: { organization: $organizationId, project: $projectId }) {
      total
      nodes {
        id
        name
        ...TargetCard_TargetFragment
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

export function ProjectPage(props: { organizationId: string; projectId: string }): ReactElement {
  return (
    <>
      <Meta title="Targets" />
      <ProjectsPageContent organizationId={props.organizationId} projectId={props.projectId} />
    </>
  );
}
