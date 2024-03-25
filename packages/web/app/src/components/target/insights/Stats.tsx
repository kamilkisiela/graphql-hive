import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInMilliseconds } from 'date-fns';
import ReactECharts from 'echarts-for-react';
import {
  ActivityIcon,
  BookIcon,
  ChevronUp,
  FrownIcon,
  GaugeIcon,
  GlobeIcon,
  PercentIcon,
  SmileIcon,
} from 'lucide-react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useQuery } from 'urql';
import { Section } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CHART_PRIMARY_COLOR } from '@/constants';
import { FragmentType, graphql, useFragment } from '@/gql';
import { DateRangeInput } from '@/graphql';
import {
  formatDuration,
  formatNumber,
  formatThroughput,
  toDecimal,
  useFormattedDuration,
  useFormattedNumber,
  useFormattedThroughput,
  useRouteSelector,
} from '@/lib/hooks';
import { useChartStyles } from '@/utils';
import { OperationsFallback } from './Fallback';
import { createEmptySeries, resolutionToMilliseconds } from './utils';

const Stats_GeneralOperationsStatsQuery = graphql(`
  query Stats_GeneralOperationsStats(
    $selector: OperationsStatsSelectorInput!
    $allOperationsSelector: OperationsStatsSelectorInput!
    $resolution: Int!
  ) {
    allOperations: operationsStats(selector: $allOperationsSelector) {
      totalRequests
    }
    operationsStats(selector: $selector) {
      ... on OperationsStats {
        totalRequests
        totalFailures
        totalOperations
        duration {
          p75
          p90
          p95
          p99
        }
      }
      ...OverTimeStats_OperationsStatsFragment
      ...RpmOverTimeStats_OperationStatsFragment
      ...LatencyOverTimeStats_OperationStatsFragment
      ...ClientsStats_OperationsStatsFragment
    }
  }
`);

function RequestsStats({
  requests = 0,
}: {
  requests?: number;
  dateRangeText: string;
}): ReactElement {
  const value = useFormattedNumber(requests);

  return (
    <Card className="bg-gray-900/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Requests</CardTitle>
        <GlobeIcon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-muted-foreground text-xs">Total requests served</p>
      </CardContent>
    </Card>
  );
}

function UniqueOperationsStats({
  operations = 0,
  dateRangeText,
}: {
  operations?: number;
  dateRangeText: string;
}): ReactElement {
  const value = useFormattedNumber(operations);

  return (
    <Card className="bg-gray-900/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Operations</CardTitle>
        <BookIcon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-muted-foreground text-xs">
          Distinct GraphQL operations in {dateRangeText}
        </p>
      </CardContent>
    </Card>
  );
}

function OperationRelativeFrequency({
  allOperationRequests,
  operationRequests,
}: {
  allOperationRequests: number;
  operationRequests: number;
  dateRangeText: string;
}): ReactElement {
  const rate = allOperationRequests
    ? `${toDecimal((operationRequests * 100) / allOperationRequests)}%`
    : '-';

  return (
    <Card className="bg-gray-900/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Relative Request Frequency</CardTitle>
        <PercentIcon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{rate}</div>
        <p className="text-muted-foreground text-xs">The impact on the overall API traffic</p>
      </CardContent>
    </Card>
  );
}

function PercentileStats({
  value,
  percentile,
  dateRangeText,
}: {
  value?: number;
  percentile: number;
  dateRangeText: string;
}): ReactElement {
  const formatted = useFormattedDuration(value);

  return (
    <Card className="bg-gray-900/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">p{percentile}</CardTitle>
        <GaugeIcon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatted}</div>
        <p className="text-muted-foreground text-xs">
          Latency p{percentile} in {dateRangeText}
        </p>
      </CardContent>
    </Card>
  );
}

function RPM({
  period,
  dateRangeText,
  requests = 0,
}: {
  requests?: number;
  dateRangeText: string;
  period: {
    from: string;
    to: string;
  };
}): ReactElement {
  const throughput = useFormattedThroughput({
    requests,
    window: differenceInMilliseconds(new Date(period.to), new Date(period.from)),
  });

  return (
    <Card className="bg-gray-900/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Requests per minute</CardTitle>
        <ActivityIcon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{throughput}</div>
        <p className="text-muted-foreground text-xs">Throughput in {dateRangeText}</p>
      </CardContent>
    </Card>
  );
}

function SuccessRateStats({
  requests = 0,
  totalFailures = 0,
  dateRangeText,
}: {
  requests?: number;
  totalFailures?: number;
  dateRangeText: string;
}): ReactElement {
  const rate =
    requests || totalFailures
      ? `${toDecimal(((requests - totalFailures) * 100) / requests)}%`
      : '-';

  return (
    <Card className="bg-gray-900/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-emerald-500 dark:text-emerald-500">
          Success rate
        </CardTitle>
        <SmileIcon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{rate}</div>
        <p className="text-muted-foreground text-xs">Successful requests in {dateRangeText}</p>
      </CardContent>
    </Card>
  );
}

function FailureRateStats({
  requests = 0,
  totalFailures = 0,
  dateRangeText,
}: {
  requests?: number;
  totalFailures?: number;
  dateRangeText: string;
}): ReactElement {
  const rate = requests || totalFailures ? `${toDecimal((totalFailures * 100) / requests)}%` : '-';

  return (
    <Card className="bg-gray-900/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-red-500 dark:text-red-500">
          Failure rate
        </CardTitle>
        <FrownIcon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{rate}</div>
        <p className="text-muted-foreground text-xs">Failed requests in {dateRangeText}</p>
      </CardContent>
    </Card>
  );
}

const OverTimeStats_OperationsStatsFragment = graphql(`
  fragment OverTimeStats_OperationsStatsFragment on OperationsStats {
    failuresOverTime(resolution: $resolution) {
      date
      value
    }
    requestsOverTime(resolution: $resolution) {
      date
      value
    }
  }
`);

function OverTimeStats({
  period,
  resolution,
  operationStats,
}: {
  period: DateRangeInput;
  resolution: number;
  operationStats: FragmentType<typeof OverTimeStats_OperationsStatsFragment> | null;
}): ReactElement {
  const { failuresOverTime = [], requestsOverTime = [] } =
    useFragment(OverTimeStats_OperationsStatsFragment, operationStats) ?? {};

  const styles = useChartStyles();
  const interval = resolutionToMilliseconds(resolution, period);
  const requests = useMemo(() => {
    if (requestsOverTime?.length) {
      return requestsOverTime.map<[string, number]>(node => [node.date, node.value]);
    }

    return createEmptySeries({ interval, period });
  }, [requestsOverTime, interval, period]);

  const failures = useMemo(() => {
    if (failuresOverTime?.length) {
      return failuresOverTime.map<[string, number]>(node => [node.date, node.value]);
    }

    return createEmptySeries({ interval, period });
  }, [failuresOverTime, interval, period]);

  return (
    <div className="rounded-md border border-gray-800 bg-gray-900/50 p-5">
      <Section.Title>Operations over time</Section.Title>
      <Section.Subtitle>Timeline of GraphQL requests and failures</Section.Subtitle>
      <AutoSizer disableHeight>
        {size => (
          <ReactECharts
            style={{ width: size.width, height: 200 }}
            option={{
              ...styles,
              grid: {
                left: 20,
                top: 50,
                right: 20,
                bottom: 20,
                containLabel: true,
              },
              tooltip: {
                trigger: 'axis',
              },
              xAxis: [
                {
                  type: 'time',
                  boundaryGap: false,
                  min: period.from,
                  max: period.to,
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
                  data: requests,
                },
                {
                  type: 'line',
                  name: 'Failures',
                  showSymbol: false,
                  smooth: false,
                  color: '#ef4444',
                  areaStyle: {},
                  emphasis: {
                    focus: 'series',
                  },
                  large: true,
                  data: failures,
                },
              ],
            }}
          />
        )}
      </AutoSizer>
    </div>
  );
}

const ClientsStats_OperationsStatsFragment = graphql(`
  fragment ClientsStats_OperationsStatsFragment on OperationsStats {
    clients {
      nodes {
        name
        count
        percentage
        versions {
          version
          count
          percentage
        }
      }
      total
    }
  }
`);

function getLevelOption() {
  return [
    {
      itemStyle: {
        borderWidth: 0,
        gapWidth: 5,
      },
    },
    {
      itemStyle: {
        gapWidth: 1,
      },
    },
    {
      colorSaturation: [0.35, 0.5],
      itemStyle: {
        gapWidth: 1,
        borderColorSaturation: 0.6,
      },
    },
  ];
}

function ClientsStats(props: {
  operationStats: FragmentType<typeof ClientsStats_OperationsStatsFragment> | null;
}): ReactElement {
  const router = useRouteSelector();
  const styles = useChartStyles();
  const operationStats = useFragment(ClientsStats_OperationsStatsFragment, props.operationStats);
  const sortedClients = useMemo(() => {
    return operationStats?.clients.nodes?.length
      ? operationStats.clients.nodes.slice().sort((a, b) => b.count - a.count)
      : [];
  }, [operationStats?.clients.nodes]);
  const otherClientsPrefix = 'Other clients';
  const byClient = useMemo(() => {
    let values: string[] = [];
    const labels: string[] = [];

    if (sortedClients?.length) {
      const total = sortedClients.reduce((acc, node) => acc + node.count, 0);
      const counts: number[] = [];

      for (let i = 0; i < sortedClients.length; i++) {
        const client = sortedClients[i];

        if (i < 4) {
          counts.push(client.count);
          labels.push(client.name);
        } else if (labels[4]) {
          counts[4] += client.percentage;
        } else {
          counts.push(client.count);
          labels.push(
            sortedClients.length === 5
              ? client.name
              : `${otherClientsPrefix} (${sortedClients.length - 4})`,
          );
        }
      }

      values = counts.map(value => toDecimal((value * 100) / total));
    }

    return { labels, values };
  }, [sortedClients]);

  const byVersion = useMemo(() => {
    let values: string[] = [];
    const labels: string[] = [];
    if (sortedClients?.length) {
      const total = sortedClients.reduce((acc, node) => acc + node.count, 0);
      const versions: Array<{
        name: string;
        count: number;
      }> = [];

      for (const client of sortedClients) {
        for (const version of client.versions) {
          versions.push({
            name: `${client.name}@${version.version.substr(0, 32)}`,
            count: version.count,
          });
        }
      }

      versions.sort((a, b) => b.count - a.count);

      const counts: number[] = [];
      for (let i = 0; i < versions.length; i++) {
        const version = versions[i];

        if (i < 4) {
          counts.push(version.count);
          labels.push(version.name);
        } else if (labels[4]) {
          counts[4] += version.count;
        } else {
          counts.push(version.count);
          labels.push(
            versions.length === 5 ? version.name : `Other versions (${versions.length - 4})`,
          );
        }
      }

      values = counts.map(value => toDecimal((value * 100) / total));
    }

    return { labels, values };
  }, [sortedClients]);

  const byClientAndVersion = useMemo(() => {
    const dataPoints: Array<{
      value: number;
      name: string;
      path: string;
      children: Array<{
        value: number;
        name: string;
        path: string;
      }>;
    }> = [];
    if (sortedClients?.length) {
      for (const client of sortedClients) {
        const versions: Array<{
          value: number;
          name: string;
          path: string;
        }> = [];

        for (const version of client.versions) {
          versions.push({
            value: version.count,
            name: version.version,
            path: `${client.name}@${version.version}`,
          });
        }

        dataPoints.push({
          value: client.count,
          name: client.name,
          path: client.name,
          children: versions,
        });
      }
    }
    return dataPoints;
  }, [sortedClients]);

  const [isOpen, setIsOpen] = useState(false);

  const onClientNameClick = useCallback(
    (ev: { componentType: string; targetType: string; value: string }) => {
      if (ev.componentType === 'yAxis' && ev.targetType === 'axisLabel') {
        if (ev.value.startsWith(otherClientsPrefix)) {
          // Label for "Other clients" was clicked, do nothing
          return;
        }

        void router.push({
          pathname: '/[organizationId]/[projectId]/[targetId]/insights/client/[name]',
          query: {
            organizationId: router.organizationId,
            projectId: router.projectId,
            targetId: router.targetId,
            name: ev.value,
          },
        });
      }
    },
    [router],
  );

  return (
    <div className="w-full rounded-md border border-gray-800 bg-gray-900/50 p-5">
      <Section.Title>Clients</Section.Title>
      <Section.Subtitle>Top 5 - GraphQL API consumers</Section.Subtitle>
      <AutoSizer disableHeight className="mt-5 flex w-full flex-row gap-x-4">
        {size => {
          if (!size.width) {
            return <></>;
          }

          const gapX4 = 16;
          const innerWidth = size.width - gapX4 * 2;

          return (
            <>
              <ReactECharts
                style={{
                  width: innerWidth / 2,
                  height: 200,
                }}
                onEvents={{
                  click: onClientNameClick,
                }}
                option={{
                  ...styles,
                  grid: {
                    left: 20,
                    top: 20,
                    right: 20,
                    bottom: 20,
                    containLabel: true,
                  },
                  tooltip: {
                    trigger: 'item',
                    formatter: '{b0}: {c0}%',
                  },
                  xAxis: {
                    type: 'value',
                    splitLine: {
                      lineStyle: {
                        color: '#595959',
                        type: 'dashed',
                      },
                    },
                    axisLabel: {
                      formatter: '{value}%',
                    },
                  },
                  yAxis: {
                    type: 'category',
                    data: byClient.labels,
                    triggerEvent: true,
                  },
                  series: [
                    {
                      type: 'bar',
                      data: byClient.values,
                      color: CHART_PRIMARY_COLOR,
                    },
                  ],
                }}
              />
              <ReactECharts
                style={{ width: innerWidth / 2, height: 200 }}
                option={{
                  ...styles,
                  grid: {
                    left: 20,
                    top: 20,
                    right: 20,
                    bottom: 20,
                    containLabel: true,
                  },
                  tooltip: {
                    trigger: 'item',
                    formatter: '{b0}: {c0}%',
                  },
                  xAxis: {
                    type: 'value',
                    splitLine: {
                      lineStyle: {
                        color: '#595959',
                        type: 'dashed',
                      },
                    },
                    axisLabel: {
                      formatter: '{value}%',
                    },
                  },
                  yAxis: {
                    type: 'category',
                    data: byVersion.labels,
                  },
                  series: [
                    {
                      type: 'bar',
                      data: byVersion.values,
                      color: CHART_PRIMARY_COLOR,
                    },
                  ],
                }}
              />
            </>
          );
        }}
      </AutoSizer>
      {isOpen ? (
        <AutoSizer disableHeight className="mt-5 w-full">
          {size => {
            if (!size.width) {
              return <></>;
            }

            const gapX4 = 16;
            const innerWidth = size.width - gapX4;

            return (
              <ReactECharts
                style={{ width: innerWidth, height: 400, marginLeft: 'auto', marginRight: 'auto' }}
                option={{
                  ...styles,
                  grid: {
                    left: 20,
                    top: 20,
                    right: 20,
                    bottom: 20,
                    containLabel: true,
                  },
                  tooltip: {
                    trigger: 'item',
                    formatter(dataPoint: {
                      data: {
                        name: string;
                        value: number;
                      };
                    }) {
                      return `${dataPoint.data.name}: ${formatNumber(dataPoint.data.value)}`;
                    },
                  },
                  legend: {
                    show: false,
                  },
                  series: [
                    {
                      name: 'All clients and versions',
                      type: 'treemap',
                      label: {
                        show: true,
                        formatter: '{b}',
                      },
                      upperLabel: {
                        show: true,
                        height: 30,
                        color: '#fff',
                        backgroundColor: 'transparent',
                        padding: 5,
                        fontWeight: 'bold',
                      },
                      itemStyle: {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                      },
                      levels: getLevelOption(),
                      data: byClientAndVersion,
                      color: CHART_PRIMARY_COLOR,
                    },
                  ],
                }}
              />
            );
          }}
        </AutoSizer>
      ) : null}
      <div className="mt-5 w-full text-center">
        <Button variant="outline" onClick={() => setIsOpen(value => !value)}>
          {isOpen ? (
            <>
              <ChevronUp className="mr-2 size-4" /> Hide
            </>
          ) : (
            'Display all versions'
          )}
        </Button>
      </div>
    </div>
  );
}

const LatencyOverTimeStats_OperationStatsFragment = graphql(`
  fragment LatencyOverTimeStats_OperationStatsFragment on OperationsStats {
    durationOverTime(resolution: $resolution) {
      date
      duration {
        p75
        p90
        p95
        p99
      }
    }
  }
`);

function LatencyOverTimeStats({
  period,
  resolution,
  operationStats,
}: {
  period: {
    from: string;
    to: string;
  };
  resolution: number;
  operationStats?: FragmentType<typeof LatencyOverTimeStats_OperationStatsFragment> | null;
}): ReactElement {
  const styles = useChartStyles();
  const interval = resolutionToMilliseconds(resolution, period);
  const { durationOverTime: duration = [] } =
    useFragment(LatencyOverTimeStats_OperationStatsFragment, operationStats) ?? {};
  const p75 = useMemo(() => {
    if (duration?.length) {
      return duration.map<[string, number]>(node => [node.date, node.duration.p75]);
    }

    return createEmptySeries({ interval, period });
  }, [duration, interval, period]);
  const p90 = useMemo(() => {
    if (duration?.length) {
      return duration.map<[string, number]>(node => [node.date, node.duration.p90]);
    }

    return createEmptySeries({ interval, period });
  }, [duration, interval, period]);
  const p95 = useMemo(() => {
    if (duration?.length) {
      return duration.map<[string, number]>(node => [node.date, node.duration.p95]);
    }

    return createEmptySeries({ interval, period });
  }, [duration, interval, period]);
  const p99 = useMemo(() => {
    if (duration?.length) {
      return duration.map<[string, number]>(node => [node.date, node.duration.p99]);
    }

    return createEmptySeries({ interval, period });
  }, [duration, interval, period]);

  function createSeries(name: string, color: string, data: [string, number][]) {
    return {
      name,
      type: 'line',
      smooth: false,
      showSymbol: false,
      color,
      emphasis: { focus: 'series' },
      large: true,
      data,
    };
  }

  const series = [
    createSeries('p75', '#10b981', p75),
    createSeries('p90', '#0ea5e9', p90),
    createSeries('p95', '#8b5cf6', p95),
    createSeries('p99', '#ec4899', p99),
  ];

  return (
    <div className="rounded-md border border-gray-800 bg-gray-900/50 p-5">
      <Section.Title>Latency over time</Section.Title>
      <Section.Subtitle>Timeline of latency of GraphQL requests</Section.Subtitle>
      <AutoSizer disableHeight>
        {size => (
          <ReactECharts
            style={{ width: size.width, height: 200 }}
            option={{
              ...styles,
              grid: {
                left: 20,
                top: 50,
                right: 20,
                bottom: 20,
                containLabel: true,
              },
              tooltip: { trigger: 'axis' },
              color: series.map(s => s.color),
              legend: {
                ...styles.legend,
                data: series.map(s => s.name),
              },
              xAxis: [
                {
                  type: 'time',
                  boundaryGap: false,
                  splitLine: {
                    lineStyle: {
                      color: '#595959',
                      type: 'dashed',
                    },
                  },
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
                    formatter: (value: number) => formatDuration(value, true),
                  },
                },
              ],
              series,
            }}
          />
        )}
      </AutoSizer>
    </div>
  );
}

const RpmOverTimeStats_OperationStatsFragment = graphql(`
  fragment RpmOverTimeStats_OperationStatsFragment on OperationsStats {
    requestsOverTime(resolution: $resolution) {
      date
      value
    }
  }
`);

function RpmOverTimeStats({
  period,
  resolution,
  operationStats,
}: {
  period: {
    from: string;
    to: string;
  };
  resolution: number;
  operationStats: FragmentType<typeof RpmOverTimeStats_OperationStatsFragment> | null;
}): ReactElement {
  const styles = useChartStyles();
  const { requestsOverTime: requests = [] } =
    useFragment(RpmOverTimeStats_OperationStatsFragment, operationStats) ?? {};

  const interval = resolutionToMilliseconds(resolution, period);
  const windowInM = interval / (60 * 1000);
  const rpmOverTime = useMemo(() => {
    if (requests.length) {
      return requests.map<[string, number]>(node => [
        node.date,
        parseFloat((node.value / windowInM).toFixed(4)),
      ]);
    }

    return createEmptySeries({ interval, period });
  }, [requests, interval, period, windowInM]);

  return (
    <div className="rounded-md border border-gray-800 bg-gray-900/50 p-5">
      <Section.Title>RPM over time</Section.Title>
      <Section.Subtitle>Requests per minute</Section.Subtitle>
      <AutoSizer disableHeight>
        {size => (
          <ReactECharts
            style={{ width: size.width, height: 200 }}
            option={{
              ...styles,
              grid: {
                left: 20,
                top: 50,
                right: 20,
                bottom: 20,
                containLabel: true,
              },
              tooltip: {
                trigger: 'axis',
              },
              xAxis: [
                {
                  type: 'time',
                  boundaryGap: false,
                  min: period.from,
                  max: period.to,
                  splitLine: {
                    lineStyle: {
                      color: '#595959',
                      type: 'dashed',
                    },
                  },
                },
              ],
              yAxis: [
                {
                  type: 'value',
                  boundaryGap: false,
                  min: 0,
                  axisLabel: {
                    formatter: (value: number) => formatThroughput(value * 10, interval),
                  },
                  splitLine: {
                    lineStyle: {
                      color: '#595959',
                      type: 'dashed',
                    },
                  },
                },
              ],
              series: [
                {
                  type: 'bar',
                  name: 'RPM',
                  symbol: 'none',
                  smooth: false,
                  areaStyle: {
                    color: CHART_PRIMARY_COLOR,
                  },
                  lineStyle: {
                    color: CHART_PRIMARY_COLOR,
                  },
                  color: CHART_PRIMARY_COLOR,
                  large: true,
                  data: rpmOverTime,
                },
              ],
            }}
          />
        )}
      </AutoSizer>
    </div>
  );
}

export function OperationsStats({
  organization,
  project,
  target,
  period,
  operationsFilter,
  clientNamesFilter,
  resolution,
  mode,
  dateRangeText,
}: {
  organization: string;
  project: string;
  target: string;
  period: {
    from: string;
    to: string;
  };
  dateRangeText: string;
  resolution: number;
  operationsFilter: string[];
  clientNamesFilter: Array<string>;
  mode: 'operation-page' | 'operation-list';
}): ReactElement {
  const [query, refetchQuery] = useQuery({
    query: Stats_GeneralOperationsStatsQuery,
    variables: {
      selector: {
        organization,
        project,
        target,
        period,
        operations: operationsFilter,
        clientNames: clientNamesFilter,
      },
      allOperationsSelector: {
        organization,
        project,
        target,
        period,
      },
      resolution,
    },
  });

  const refetch = useCallback(() => {
    refetchQuery({
      requestPolicy: 'cache-and-network',
    });
  }, [refetchQuery]);

  useEffect(() => {
    if (!query.fetching) {
      refetch();
    }
  }, [period]);

  const isFetching = query.fetching;
  const isError = !!query.error;

  const operationsStats = query.data?.operationsStats;
  const allOperationsStats = query.data?.allOperations;
  dateRangeText = dateRangeText.toLowerCase();

  const state = isFetching
    ? 'fetching'
    : isError
      ? 'error'
      : !operationsStats?.totalRequests
        ? 'empty'
        : 'success';

  return (
    <section className="space-y-12 text-gray-600 transition-opacity duration-700 ease-in-out dark:text-gray-400">
      <OperationsFallback state={state} refetch={refetch}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <RequestsStats requests={operationsStats?.totalRequests} dateRangeText={dateRangeText} />
          <RPM
            requests={operationsStats?.totalRequests}
            period={period}
            dateRangeText={dateRangeText}
          />
          {mode === 'operation-list' ? (
            <UniqueOperationsStats
              operations={operationsStats?.totalOperations}
              dateRangeText={dateRangeText}
            />
          ) : (
            <OperationRelativeFrequency
              allOperationRequests={allOperationsStats?.totalRequests ?? 0}
              operationRequests={operationsStats?.totalRequests ?? 0}
              dateRangeText={dateRangeText}
            />
          )}
          <SuccessRateStats
            requests={operationsStats?.totalRequests}
            totalFailures={operationsStats?.totalFailures}
            dateRangeText={dateRangeText}
          />
          <PercentileStats
            value={operationsStats?.duration?.p99}
            percentile={99}
            dateRangeText={dateRangeText}
          />
          <PercentileStats
            value={operationsStats?.duration?.p95}
            percentile={95}
            dateRangeText={dateRangeText}
          />
          <PercentileStats
            value={operationsStats?.duration?.p90}
            percentile={90}
            dateRangeText={dateRangeText}
          />
          <FailureRateStats
            requests={operationsStats?.totalRequests}
            totalFailures={operationsStats?.totalFailures}
            dateRangeText={dateRangeText}
          />
        </div>
      </OperationsFallback>
      <div>
        <OperationsFallback state={state} refetch={refetch}>
          <ClientsStats operationStats={operationsStats ?? null} />
        </OperationsFallback>
      </div>
      <div>
        <OperationsFallback state={state} refetch={refetch}>
          <OverTimeStats
            period={period}
            resolution={resolution}
            operationStats={operationsStats ?? null}
          />
        </OperationsFallback>
      </div>
      <div>
        <OperationsFallback state={state} refetch={refetch}>
          <RpmOverTimeStats
            period={period}
            resolution={resolution}
            operationStats={operationsStats ?? null}
          />
        </OperationsFallback>
      </div>
      <div>
        <OperationsFallback state={state} refetch={refetch}>
          <LatencyOverTimeStats
            period={period}
            operationStats={operationsStats ?? null}
            resolution={resolution}
          />
        </OperationsFallback>
      </div>
    </section>
  );
}
