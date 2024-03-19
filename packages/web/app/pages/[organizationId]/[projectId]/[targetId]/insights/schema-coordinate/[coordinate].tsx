import { ReactElement, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { differenceInMilliseconds } from 'date-fns';
import ReactECharts from 'echarts-for-react';
import {
  ActivityIcon,
  AlertCircleIcon,
  BookIcon,
  GlobeIcon,
  RefreshCw,
  TabletSmartphoneIcon,
} from 'lucide-react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useQuery } from 'urql';
import { authenticated } from '@/components/authenticated-container';
import { Page, TargetLayout } from '@/components/layouts/target';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker, presetLast7Days } from '@/components/ui/date-range-picker';
import { Subtitle, Title } from '@/components/ui/page';
import { QueryError } from '@/components/ui/query-error';
import { EmptyList, Link as LegacyLink, MetaTitle } from '@/components/v2';
import { CHART_PRIMARY_COLOR } from '@/constants';
import { graphql } from '@/gql';
import { formatNumber, formatThroughput, toDecimal, useRouteSelector } from '@/lib/hooks';
import { useDateRangeController } from '@/lib/hooks/use-date-range-controller';
import { withSessionProtection } from '@/lib/supertokens/guard';
import { useChartStyles } from '@/utils';

const SchemaCoordinateView_SchemaCoordinateStatsQuery = graphql(`
  query SchemaCoordinateView_SchemaCoordinateStatsQuery(
    $selector: SchemaCoordinateStatsInput!
    $targetSelector: TargetSelectorInput!
    $resolution: Int!
  ) {
    schemaCoordinateStats(selector: $selector) {
      requestsOverTime(resolution: $resolution) {
        date
        value
      }
      totalRequests
      operations {
        nodes {
          id
          name
          operationHash
          count
        }
      }
      clients {
        nodes {
          name
          count
        }
      }
    }
    target(selector: $targetSelector) {
      id
      hasCollectedSubscriptionOperations
    }
  }
`);

function SchemaCoordinateView(props: {
  coordinate: string;
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
    query: SchemaCoordinateView_SchemaCoordinateStatsQuery,
    variables: {
      selector: {
        organization: props.organizationCleanId,
        project: props.projectCleanId,
        target: props.targetCleanId,
        schemaCoordinate: props.coordinate,
        period: dateRangeController.resolvedRange,
      },
      targetSelector: {
        organization: props.organizationCleanId,
        project: props.projectCleanId,
        target: props.targetCleanId,
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
  const points = query.data?.schemaCoordinateStats?.requestsOverTime;
  const requestsOverTime = useMemo(() => {
    if (!points) {
      return [];
    }

    return points.map(node => [node.date, node.value]);
  }, [points]);
  const totalRequests = query.data?.schemaCoordinateStats?.totalRequests ?? 0;
  const totalOperations = query.data?.schemaCoordinateStats?.operations.nodes.length ?? 0;
  const totalClients = query.data?.schemaCoordinateStats?.clients.nodes.length ?? 0;

  if (query.error) {
    return <QueryError error={query.error} />;
  }

  return (
    <>
      <div className="flex flex-row items-center justify-between py-6">
        <div>
          <Title>{props.coordinate}</Title>
          <Subtitle>Schema coordinate insights</Subtitle>
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
      {query.data?.target?.hasCollectedSubscriptionOperations && (
        <div className="pb-8">
          <Alert>
            <AlertCircleIcon className="size-4" />
            <AlertTitle>No Subscription insights available yet.</AlertTitle>
            <AlertDescription>
              This page currently only shows the information for Query and Mutation operations. We
              are currently evaluating what kind of insights are useful for subscriptions.{' '}
              <LegacyLink
                variant="primary"
                href="https://github.com/kamilkisiela/graphql-hive/issues/3290"
              >
                Please reach out to us directly or via the GitHub issue
              </LegacyLink>
              .
            </AlertDescription>
          </Alert>
        </div>
      )}
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
                    GraphQL documents with selected coordinate
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gray-900/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Consumers</CardTitle>
                  <TabletSmartphoneIcon className="text-muted-foreground size-4" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{isLoading ? '-' : totalClients}</div>
                  <p className="text-muted-foreground text-xs">
                    GraphQL clients in {dateRangeController.selectedPreset.label.toLowerCase()}
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
                  GraphQL requests with {props.coordinate} over time
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
                {props.coordinate} was used by {isLoading ? '-' : totalOperations}{' '}
                {totalOperations > 1 ? 'operations' : 'operation'} in{' '}
                {dateRangeController.selectedPreset.label.toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-[120px] grow basis-0 overflow-y-auto">
              <div className="space-y-2">
                {isLoading
                  ? null
                  : query.data?.schemaCoordinateStats.operations.nodes.map(operation => (
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
              <CardTitle>Clients</CardTitle>
              <CardDescription>
                {props.coordinate} was used by {isLoading ? '-' : totalClients}{' '}
                {totalClients > 1 ? 'clients' : 'client'} in{' '}
                {dateRangeController.selectedPreset.label.toLowerCase()}.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-[170px] grow basis-0 overflow-y-auto">
              <div className="space-y-2">
                {isLoading
                  ? null
                  : query.data?.schemaCoordinateStats.clients.nodes.map(client => (
                      <div key={client.name} className="flex items-center">
                        <p className="truncate text-sm font-medium">
                          <Link
                            className="text-orange-500 hover:text-orange-500 hover:underline hover:underline-offset-2"
                            href={{
                              pathname:
                                '/[organizationId]/[projectId]/[targetId]/insights/client/[name]',
                              query: {
                                organizationId: props.organizationCleanId,
                                projectId: props.projectCleanId,
                                targetId: props.targetCleanId,
                                name: client.name,
                              },
                            }}
                          >
                            {client.name}
                          </Link>
                        </p>
                        <div className="ml-auto flex min-w-[150px] flex-row items-center justify-end text-sm font-light">
                          <div>{formatNumber(client.count)}</div>
                          <div className="min-w-[70px] text-right">
                            {toDecimal((client.count * 100) / totalRequests)}%
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

const TargetSchemaCoordinatePageQuery = graphql(`
  query TargetSchemaCoordinatePageQuery($organizationId: ID!, $projectId: ID!, $targetId: ID!) {
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
      id
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

function TargetSchemaCoordinatePageContent({ coordinate }: { coordinate: string }) {
  const router = useRouteSelector();
  const [query] = useQuery({
    query: TargetSchemaCoordinatePageQuery,
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
          <SchemaCoordinateView
            coordinate={coordinate}
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

function SchemaCoordinatePage(): ReactElement {
  const router = useRouter();
  const { coordinate } = router.query;

  if (!coordinate || typeof coordinate !== 'string') {
    throw new Error('Invalid coordinate');
  }

  return (
    <>
      <MetaTitle title={`${coordinate} - schema coordinate`} />
      <TargetSchemaCoordinatePageContent coordinate={coordinate} />
    </>
  );
}

export const getServerSideProps = withSessionProtection();

export default authenticated(SchemaCoordinatePage);
