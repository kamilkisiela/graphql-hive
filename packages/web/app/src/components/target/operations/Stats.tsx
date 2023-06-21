import { ReactElement, useCallback, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useQuery } from 'urql';
import { Section } from '@/components/common';
import { CHART_PRIMARY_COLOR } from '@/constants';
import {
  DateRangeInput,
  GeneralOperationsStatsDocument,
  GeneralOperationsStatsQuery,
} from '@/graphql';
import {
  formatDuration,
  formatNumber,
  formatThroughput,
  toDecimal,
  useFormattedDuration,
  useFormattedNumber,
  useFormattedThroughput,
} from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { useChartStyles } from '@/utils';
import { OperationsFallback } from './Fallback';
import { createEmptySeries, fullSeries, resolutionToMilliseconds } from './utils';

const classes = {
  root: cn('text-center'),
  value: cn('font-normal text-3xl text-gray-900 dark:text-white'),
  title: cn('text-sm leading-relaxed'),
};

function RequestsStats({ requests = 0 }: { requests?: number }): ReactElement {
  const value = useFormattedNumber(requests);

  return (
    <div className={classes.root}>
      <h2 className={classes.value}>{value}</h2>
      <p className={classes.title}>Requests</p>
    </div>
  );
}

function UniqueOperationsStats({ operations = 0 }: { operations?: number }): ReactElement {
  const value = useFormattedNumber(operations);

  return (
    <div className={classes.root}>
      <h2 className={classes.value}>{value}</h2>
      <p className={classes.title}>Unique Operations</p>
    </div>
  );
}

function PercentileStats({ value, title }: { value?: number; title: string }): ReactElement {
  const formatted = useFormattedDuration(value);

  return (
    <div className={classes.root}>
      <h2 className={classes.value}>{formatted}</h2>
      <p className={classes.title}>{title}</p>
    </div>
  );
}

function RPM({
  period,
  requests = 0,
}: {
  requests?: number;
  period: {
    from: string;
    to: string;
  };
}): ReactElement {
  const throughput = useFormattedThroughput({
    requests,
    window: new Date(period.to).getTime() - new Date(period.from).getTime(),
  });
  return (
    <div className={classes.root}>
      <h2 className={classes.value}>{throughput}</h2>
      <p className={classes.title}>RPM</p>
    </div>
  );
}

function SuccessRateStats({
  requests = 0,
  totalFailures = 0,
}: {
  requests?: number;
  totalFailures?: number;
}): ReactElement {
  const rate =
    requests || totalFailures
      ? `${toDecimal(((requests - totalFailures) * 100) / requests)}%`
      : '-';

  return (
    <div className={classes.root}>
      <h2 className={cn(classes.value, 'text-emerald-500 dark:text-emerald-500')}>{rate}</h2>
      <p className={classes.title}>Success rate</p>
    </div>
  );
}

function FailureRateStats({
  requests = 0,
  totalFailures = 0,
}: {
  requests?: number;
  totalFailures?: number;
}): ReactElement {
  const rate = requests || totalFailures ? `${toDecimal((totalFailures * 100) / requests)}%` : '-';

  return (
    <div className={cn(classes.root)}>
      <h2 className={cn(classes.value, 'text-red-500 dark:text-red-500')}>{rate}</h2>
      <p className={classes.title}>Failure rate</p>
    </div>
  );
}

function OverTimeStats({
  period,
  resolution,
  requestsOverTime = [],
  failuresOverTime = [],
}: {
  period: DateRangeInput;
  resolution: number;
  requestsOverTime?: GeneralOperationsStatsQuery['operationsStats']['requestsOverTime'];
  failuresOverTime?: GeneralOperationsStatsQuery['operationsStats']['failuresOverTime'];
}): ReactElement {
  const styles = useChartStyles();
  const interval = resolutionToMilliseconds(resolution, period);
  const requests = useMemo(() => {
    if (requestsOverTime?.length) {
      return fullSeries(
        requestsOverTime.map<[string, number]>(node => [node.date, node.value]),
        interval,
        period,
      );
    }

    return createEmptySeries({ interval, period });
  }, [requestsOverTime, interval, period]);

  const failures = useMemo(() => {
    if (failuresOverTime?.length) {
      return fullSeries(
        failuresOverTime.map<[string, number]>(node => [node.date, node.value]),
        interval,
        period,
      );
    }

    return createEmptySeries({ interval, period });
  }, [failuresOverTime, interval, period]);

  return (
    <div className="rounded-md bg-gray-900/50 p-5 border border-gray-800">
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

function ClientsStats({
  clients = [],
}: {
  clients?: GeneralOperationsStatsQuery['operationsStats']['clients']['nodes'];
}): ReactElement {
  const styles = useChartStyles();
  const sortedClients = useMemo(() => {
    return clients?.length ? clients.slice().sort((a, b) => b.count - a.count) : [];
  }, [clients]);
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
              : `Other clients (${sortedClients.length - 4})`,
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

  return (
    <div className="w-full rounded-md bg-gray-900/50 p-5 border border-gray-800">
      <Section.Title>Clients</Section.Title>
      <Section.Subtitle>Top 5 - GraphQL API consumers</Section.Subtitle>
      <AutoSizer disableHeight className="mt-5 w-full flex flex-row gap-x-4">
        {size => {
          if (!size.width) {
            return <></>;
          }

          const gapX4 = 16;
          const innerWidth = size.width - gapX4 * 2;

          return (
            <>
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
                    data: byClient.labels,
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
    </div>
  );
}

function LatencyOverTimeStats({
  period,
  resolution,
  duration = [],
}: {
  period: {
    from: string;
    to: string;
  };
  resolution: number;
  duration?: GeneralOperationsStatsQuery['operationsStats']['durationOverTime'];
}): ReactElement {
  const styles = useChartStyles();
  const interval = resolutionToMilliseconds(resolution, period);
  const p75 = useMemo(() => {
    if (duration?.length) {
      return fullSeries(
        duration.map<[string, number]>(node => [node.date, node.duration.p75]),
        interval,
        period,
      );
    }

    return createEmptySeries({ interval, period });
  }, [duration, interval, period]);
  const p90 = useMemo(() => {
    if (duration?.length) {
      return fullSeries(
        duration.map<[string, number]>(node => [node.date, node.duration.p90]),
        interval,
        period,
      );
    }

    return createEmptySeries({ interval, period });
  }, [duration, interval, period]);
  const p95 = useMemo(() => {
    if (duration?.length) {
      return fullSeries(
        duration.map<[string, number]>(node => [node.date, node.duration.p95]),
        interval,
        period,
      );
    }

    return createEmptySeries({ interval, period });
  }, [duration, interval, period]);
  const p99 = useMemo(() => {
    if (duration?.length) {
      return fullSeries(
        duration.map<[string, number]>(node => [node.date, node.duration.p99]),
        interval,
        period,
      );
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
    <div className="rounded-md bg-gray-900/50 p-5 border border-gray-800">
      <Section.Title>Latency over time</Section.Title>
      <Section.Subtitle>Timeline of latency of GraphQL Operations</Section.Subtitle>
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

function RpmOverTimeStats({
  period,
  resolution,
  requestsOverTime = [],
}: {
  period: {
    from: string;
    to: string;
  };
  resolution: number;
  requestsOverTime?: GeneralOperationsStatsQuery['operationsStats']['requestsOverTime'];
}): ReactElement {
  const styles = useChartStyles();
  const requests = requestsOverTime ?? [];

  const interval = resolutionToMilliseconds(resolution, period);
  const windowInM = interval / (60 * 1000);
  const rpmOverTime = useMemo(() => {
    if (requests.length) {
      return fullSeries(
        requests.map<[string, number]>(node => [
          node.date,
          parseFloat((node.value / windowInM).toFixed(4)),
        ]),
        interval,
        period,
      );
    }

    return createEmptySeries({ interval, period });
  }, [requests, interval, period, windowInM]);

  return (
    <div className="rounded-md bg-gray-900/50 p-5 border border-gray-800">
      <Section.Title>RPM over time</Section.Title>
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
}: {
  organization: string;
  project: string;
  target: string;
  period: {
    from: string;
    to: string;
  };
  operationsFilter: string[];
}): ReactElement {
  const resolution = 90;
  const [query, refetchQuery] = useQuery({
    query: GeneralOperationsStatsDocument,
    variables: {
      selector: {
        organization,
        project,
        target,
        period,
        operations: operationsFilter,
      },
      resolution,
    },
  });

  const refetch = useCallback(() => {
    refetchQuery({
      requestPolicy: 'cache-and-network',
    });
  }, [refetchQuery]);

  const isFetching = query.fetching;
  const isError = !!query.error;

  const operationsStats = query.data?.operationsStats;

  return (
    <section className="text-gray-600 dark:text-gray-400 space-y-12 transition-opacity ease-in-out duration-700">
      <OperationsFallback isError={isError} refetch={refetch} isFetching={isFetching}>
        <div className="grid gap-y-4 grid-cols-4 rounded-md p-5 border border-gray-800 bg-gray-900/50">
          <RequestsStats requests={operationsStats?.totalRequests} />
          <RPM requests={operationsStats?.totalRequests} period={period} />
          <UniqueOperationsStats operations={operationsStats?.totalOperations} />
          <SuccessRateStats
            requests={operationsStats?.totalRequests}
            totalFailures={operationsStats?.totalFailures}
          />
          <PercentileStats value={operationsStats?.duration?.p99} title="Latency p99" />
          <PercentileStats value={operationsStats?.duration?.p95} title="Latency p95" />
          <PercentileStats value={operationsStats?.duration?.p90} title="Latency p90" />
          <FailureRateStats
            requests={operationsStats?.totalRequests}
            totalFailures={operationsStats?.totalFailures}
          />
        </div>
      </OperationsFallback>
      <div>
        <ClientsStats clients={operationsStats?.clients?.nodes} />
      </div>
      <div>
        <OperationsFallback isError={isError} refetch={refetch} isFetching={isFetching}>
          <OverTimeStats
            period={period}
            resolution={resolution}
            requestsOverTime={operationsStats?.requestsOverTime}
            failuresOverTime={operationsStats?.failuresOverTime}
          />
        </OperationsFallback>
      </div>
      <div>
        <OperationsFallback isError={isError} refetch={refetch} isFetching={isFetching}>
          <RpmOverTimeStats
            period={period}
            resolution={resolution}
            requestsOverTime={operationsStats?.requestsOverTime}
          />
        </OperationsFallback>
      </div>
      <div>
        <OperationsFallback isError={isError} refetch={refetch}>
          <LatencyOverTimeStats
            period={period}
            duration={operationsStats?.durationOverTime}
            resolution={resolution}
          />
        </OperationsFallback>
      </div>
    </section>
  );
}
