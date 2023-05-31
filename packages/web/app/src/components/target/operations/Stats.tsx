import { ReactElement, useCallback, useMemo } from 'react';
import clsx from 'clsx';
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
import { useChartStyles } from '@/utils';
import { OperationsFallback } from './Fallback';

function resolutionToMilliseconds(
  resolution: number,
  period: {
    from: string;
    to: string;
  },
) {
  const distanceInMinutes =
    (new Date(period.to).getTime() - new Date(period.from).getTime()) / 1000 / 60;

  return Math.round(distanceInMinutes / resolution) * 1000 * 60;
}

/**
 * Adds missing samples to left and right sides of the series. We end up with a smooooooth chart
 */
function fullSeries(
  data: [string, number][],
  interval: number,
  period: {
    from: string;
    to: string;
  },
): [string, number][] {
  if (!data.length) {
    return createEmptySeries({ interval, period });
  }

  // Find the first sample
  const firstSample = new Date(data[0][0]).getTime();
  // Find the last sample
  const lastSample = new Date(data[data.length - 1][0]).getTime();
  // Turn `period.from` to a number
  const startAt = new Date(period.from).getTime();
  // Turn `period.to` to a number
  const endAt = new Date(period.to).getTime();

  // Calculate the number missing steps by
  // 1. comparing two dates (last/first sample and the expected boundary sample)
  // 2. dividing by interval
  // 3. rounding to floor int
  const stepsToAddOnLeft = Math.floor(Math.abs(firstSample - startAt) / interval);
  const stepsToAddOnRight = Math.floor(Math.abs(endAt - lastSample) / interval);

  // Add n steps to the left side where each sample has its date decreased by i*interval based on the first sample
  for (let i = 1; i <= stepsToAddOnLeft; i++) {
    data.unshift([new Date(firstSample - i * interval).toISOString(), 0]);
  }

  // Add n steps to the right side where each sample has its date increased by i*interval based on the last sample
  for (let i = 1; i <= stepsToAddOnRight; i++) {
    data.push([new Date(lastSample + i * interval).toISOString(), 0]);
  }

  // Instead of creating a new array, we could move things around but this is easier
  const newData: [string, number][] = [];

  for (let i = 0; i < data.length; i++) {
    const current = data[i];
    const previous = data[i - 1];

    if (previous) {
      const currentTime = new Date(current[0]).getTime();
      const previousTime = new Date(previous[0]).getTime();
      const diff = currentTime - previousTime;

      // We do subtract the interval to make sure we don't duplicate the current sample
      const stepsToAdd = Math.floor(Math.abs(diff - interval) / interval);

      if (stepsToAdd > 0) {
        // We start with 1 because we already have one sample on the left side
        for (let j = 1; j <= stepsToAdd; j++) {
          newData.push([new Date(previousTime + j * interval).toISOString(), 0]);
        }
      }
    }

    newData.push(current);
  }

  return newData;
}

function times<T>(amount: number, f: (index: number) => T) {
  const items: Array<T> = [];
  for (let i = 0; i < amount; i++) {
    items.push(f(i));
  }
  return items;
}

function createEmptySeries({
  interval,
  period,
}: {
  interval: number;
  period: {
    from: string;
    to: string;
  };
}): [string, number][] {
  const startAt = new Date(period.from).getTime();
  const endAt = new Date(period.to).getTime();

  const steps = Math.floor((endAt - startAt) / interval);
  return times(steps, i => [new Date(startAt + i * interval).toISOString(), 0]);
}

const classes = {
  root: clsx('text-center'),
  value: clsx('font-normal text-3xl text-gray-900 dark:text-white'),
  title: clsx('text-sm leading-relaxed'),
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
      <h2 className={clsx(classes.value, 'text-emerald-500 dark:text-emerald-500')}>{rate}</h2>
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
    <div className={clsx(classes.root, 'pt-4')}>
      <h2 className={clsx(classes.value, 'text-red-500 dark:text-red-500')}>{rate}</h2>
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
      <AutoSizer disableHeight className="mt-5 w-full">
        {size => {
          if (!size.width) {
            return <></>;
          }

          return (
            <div className="flex w-full flex-row gap-4">
              <ReactECharts
                style={{ width: size.width / 2, height: 200 }}
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
                style={{ width: size.width / 2, height: 200 }}
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
            </div>
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
    createSeries('p75', '#fef08a', p75),
    createSeries('p90', '#facc15', p90),
    createSeries('p95', '#ca8a04', p95),
    createSeries('p99', '#854d0e', p99),
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
