import { ReactElement, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { differenceInMilliseconds } from 'date-fns';
import ReactECharts from 'echarts-for-react';
import { ActivityIcon, BookIcon, GlobeIcon, HistoryIcon, RefreshCw } from 'lucide-react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Page, TargetLayout } from '@/components/layouts/target';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker, presetLast7Days } from '@/components/ui/date-range-picker';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { EmptyList, MetaTitle } from '@/components/v2';
import { CHART_PRIMARY_COLOR } from '@/constants';
import { graphql } from '@/gql';
import { formatNumber, formatThroughput, toDecimal, useRouteSelector } from '@/lib/hooks';
import { useDateRangeController } from '@/lib/hooks/use-date-range-controller';
import { useChartStyles } from '@/utils';

const ClientView_ClientStatsQuery = graphql(`
  query ClientView_ClientStatsQuery($selector: ClientStatsInput!, $resolution: Int!) {
    clientStats(selector: $selector) {
      requestsOverTime(resolution: $resolution) {
        date
        value
      }
      totalRequests
      totalVersions
      operations {
        nodes {
          id
          name
          operationHash
          count
        }
      }
      versions(limit: 25) {
        version
        count
      }
    }
  }
`);

function ClientView(props: {
  clientName: string;
  dataRetentionInDays: number;
  organizationCleanId: string;
  projectCleanId: string;
  targetCleanId: string;
}) {
  const styles = useChartStyles();
  const dateRangeController = useDateRangeController({
    dataRetentionInDays: props.dataRetentionInDays,
    defaultPreset: presetLast7Days,
  });

  const [query, refetch] = useQuery({
    query: ClientView_ClientStatsQuery,
    variables: {
      selector: {
        organization: props.organizationCleanId,
        project: props.projectCleanId,
        target: props.targetCleanId,
        client: props.clientName,
        period: dateRangeController.resolvedRange,
      },
      resolution: dateRangeController.resolution,
    },
  });

  useEffect(() => {
    if (!query.fetching) {
      refetch({ requestPolicy: 'network-only' });
    }
  }, [dateRangeController.resolvedRange]);

  const isLoading = query.fetching;
  const points = query.data?.clientStats?.requestsOverTime;
  const requestsOverTime = useMemo(() => {
    if (!points) {
      return [];
    }

    return points.map(node => [node.date, node.value]);
  }, [points]);

  const totalRequests = query.data?.clientStats?.totalRequests ?? 0;
  const totalVersions = query.data?.clientStats?.totalVersions ?? 0;
  const totalOperations = query.data?.clientStats?.operations.nodes.length ?? 0;

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  return (
    <>
      <div className="flex flex-row items-center justify-between py-6">
        <div>
          <Title>{props.clientName}</Title>
          <Subtitle>GraphQL API consumer insights</Subtitle>
        </div>
        <div className="flex justify-end gap-x-2">
          <DateRangePicker
            validUnits={['y', 'M', 'w', 'd']}
            selectedRange={dateRangeController.selectedPreset.range}
            startDate={dateRangeController.startDate}
            align="end"
            onUpdate={args => dateRangeController.setSelectedPreset(args.preset)}
          />
          <Button variant="outline" onClick={() => dateRangeController.refreshResolvedRange()}>
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-4 pb-8">
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-8">
          <div className="col-span-4">
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-2">
              <Card className="bg-gray-900/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total calls</CardTitle>
                  <GlobeIcon className="text-muted-foreground size-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading ? '-' : formatNumber(totalRequests)}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Requests in {dateRangeController.selectedPreset.label.toLowerCase()}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Requests per minute</CardTitle>
                  <ActivityIcon className="text-muted-foreground size-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {isLoading
                      ? '-'
                      : formatThroughput(
                          totalRequests,
                          differenceInMilliseconds(
                            new Date(dateRangeController.resolvedRange.to),
                            new Date(dateRangeController.resolvedRange.from),
                          ),
                        )}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    RPM in {dateRangeController.selectedPreset.label.toLowerCase()}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Operations</CardTitle>
                  <BookIcon className="text-muted-foreground size-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{isLoading ? '-' : totalOperations}</div>
                  <p className="text-muted-foreground text-xs">
                    Documents requested by selected client
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Versions</CardTitle>
                  <HistoryIcon className="text-muted-foreground size-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{isLoading ? '-' : totalVersions}</div>
                  <p className="text-muted-foreground text-xs">
                    Versions in {dateRangeController.selectedPreset.label.toLowerCase()}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="col-span-4">
            <Card className="flex h-full flex-col bg-gray-900/50">
              <CardHeader>
                <CardTitle>Activity</CardTitle>
                <CardDescription>
                  GraphQL requests from {props.clientName} over time
                </CardDescription>
              </CardHeader>
              <CardContent className="min-h-[150px] grow basis-0">
                <AutoSizer>
                  {size => (
                    <ReactECharts
                      style={{ width: size.width, height: size.height }}
                      option={{
                        ...styles,
                        grid: {
                          left: 20,
                          top: 5,
                          right: 5,
                          bottom: 5,
                          containLabel: true,
                        },
                        tooltip: {
                          trigger: 'axis',
                        },
                        legend: {
                          show: false,
                        },
                        xAxis: [
                          {
                            type: 'time',
                            boundaryGap: false,
                            min: dateRangeController.resolvedRange.from,
                            max: dateRangeController.resolvedRange.to,
                          },
                        ],
                        yAxis: [
                          {
                            type: 'value',
                            min: 0,
                            splitLine: {
                              lineStyle: {
                                color: '#595959',
                                type: 'dashed',
                              },
                            },
                            axisLabel: {
                              formatter: (value: number) => formatNumber(value),
                            },
                          },
                        ],
                        series: [
                          {
                            type: 'line',
                            name: 'Requests',
                            showSymbol: false,
                            smooth: false,
                            color: CHART_PRIMARY_COLOR,
                            areaStyle: {},
                            emphasis: {
                              focus: 'series',
                            },
                            large: true,
                            data: requestsOverTime,
                          },
                        ],
                      }}
                    />
                  )}
                </AutoSizer>
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4 flex h-full flex-col bg-gray-900/50">
            <CardHeader>
              <CardTitle>Operations</CardTitle>
              <CardDescription>
                {props.clientName} requested {isLoading ? '-' : totalOperations}{' '}
                {totalOperations > 1 ? 'operations' : 'operation'} in{' '}
                {dateRangeController.selectedPreset.label.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-[120px] grow basis-0 overflow-y-auto">
              <div className="space-y-2">
                {isLoading
                  ? null
                  : query.data?.clientStats.operations.nodes.map(operation => (
                      <div key={operation.id} className="flex items-center">
                        <p className="truncate text-sm font-medium">
                          <Link
                            className="text-orange-500 hover:text-orange-500 hover:underline hover:underline-offset-2"
                            href={{
                              pathname:
                                '/[organizationId]/[projectId]/[targetId]/insights/[operationName]/[operationHash]',
                              query: {
                                organizationId: props.organizationCleanId,
                                projectId: props.projectCleanId,
                                targetId: props.targetCleanId,
                                operationName: operation.name,
                                operationHash: operation.operationHash,
                              },
                            }}
                          >
                            {operation.name}
                          </Link>
                        </p>
                        <div className="ml-auto flex min-w-[150px] flex-row items-center justify-end text-sm font-light">
                          <div>{formatNumber(operation.count)}</div>{' '}
                          <div className="min-w-[70px] text-right">
                            {toDecimal((operation.count * 100) / totalRequests)}%
                          </div>
                        </div>
                      </div>
                    ))}
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-3 flex h-full flex-col bg-gray-900/50">
            <CardHeader>
              <CardTitle>Versions</CardTitle>
              <CardDescription>
                {props.clientName} had {isLoading ? '-' : totalVersions}{' '}
                {totalVersions > 1 ? 'versions' : 'version'} in{' '}
                {dateRangeController.selectedPreset.label.toLowerCase()}.
                {!isLoading && totalVersions > 25
                  ? 'Displaying only 25 most popular versions'
                  : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-[170px] grow basis-0 overflow-y-auto">
              <div className="space-y-2">
                {isLoading
                  ? null
                  : query.data?.clientStats.versions.map(version => (
                      <div key={version.version} className="flex items-center">
                        <p className="truncate text-sm font-medium">{version.version}</p>
                        <div className="ml-auto flex min-w-[150px] flex-row items-center justify-end text-sm font-light">
                          <div>{formatNumber(version.count)}</div>
                          <div className="min-w-[70px] text-right">
                            {toDecimal((version.count * 100) / totalRequests)}%
                          </div>
                        </div>
                      </div>
                    ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

const ClientInsightsPageQuery = graphql(`
  query ClientInsightsPageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
    organizations {
      ...TargetLayout_OrganizationConnectionFragment
    }
    organization(selector: { organization: $organizationId }) {
      organization {
        ...TargetLayout_CurrentOrganizationFragment
        cleanId
        rateLimit {
          retentionInDays
        }
      }
    }
    project(selector: { organization: $organizationId, project: $projectId }) {
      ...TargetLayout_CurrentProjectFragment
      cleanId
    }
    target(selector: { organization: $organizationId, project: $projectId, target: $targetId }) {
      id
      cleanId
    }
    hasCollectedOperations(
      selector: { organization: $organizationId, project: $projectId, target: $targetId }
    )
    me {
      ...TargetLayout_MeFragment
    }
    ...TargetLayout_IsCDNEnabledFragment
  }
`);

function ClientInsightsPageContent({ clientName }: { clientName: string }) {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: ClientInsightsPageQuery,
    variables: {
      organizationId: router.organizationId,
      projectId: router.projectId,
      targetId: router.targetId,
    },
  });

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  const me = query.data?.me;
  const currentOrganization = query.data?.organization?.organization;
  const currentProject = query.data?.project;
  const currentTarget = query.data?.target;
  const organizationConnection = query.data?.organizations;
  const isCDNEnabled = query.data;
  const hasCollectedOperations = query.data?.hasCollectedOperations === true;

  return (
    <TargetLayout
      page={Page.Insights}
      currentOrganization={currentOrganization ?? null}
      currentProject={currentProject ?? null}
      me={me ?? null}
      organizations={organizationConnection ?? null}
      isCDNEnabled={isCDNEnabled ?? null}
    >
      {currentOrganization && currentProject && currentTarget ? (
        hasCollectedOperations ? (
          <ClientView
            clientName={clientName}
            dataRetentionInDays={currentOrganization.rateLimit.retentionInDays}
            organizationCleanId={router.organizationId}
            projectCleanId={router.projectId}
            targetCleanId={router.targetId}
          />
        ) : (
          <div className="py-8">
            <EmptyList
              title="Hive is waiting for your first collected operation"
              description="You can collect usage of your GraphQL API with Hive Client"
              docsUrl="/features/usage-reporting"
            />
          </div>
        )
      ) : null}
    </TargetLayout>
  );
}

function ClientInsightsPage(): ReactElement {
  const router = useRouter();
  const { name } = router.query;

  if (!name || typeof name !== 'string') {
    throw new Error('Invalid client name');
  }

  return (
    <>
      <MetaTitle title={`${name} - client`} />
      <ClientInsightsPageContent clientName={name} />
    </>
  );
}

export default authenticated(ClientInsightsPage);
