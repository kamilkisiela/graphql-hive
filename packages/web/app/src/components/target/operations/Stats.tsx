import React from 'react';
import { Grid, GridItem, useColorModeValue } from '@chakra-ui/react';
import ReactECharts from 'echarts-for-react';
import AutoSizer from 'react-virtualized-auto-sizer';
import tw from 'twin.macro';
import { useQuery } from 'urql';

import { Section } from '@/components/common';
import {
  DateRangeInput,
  DurationHistogramDocument,
  GeneralOperationsStatsDocument,
  GeneralOperationsStatsQuery,
} from '@/graphql';
import { theme } from '@/lib/charts';
import { toDecimal } from '@/lib/hooks/use-decimal';
import { formatDuration, useFormattedDuration } from '@/lib/hooks/use-formatted-duration';
import { formatNumber, useFormattedNumber } from '@/lib/hooks/use-formatted-number';
import { formatThroughput, useFormattedThroughput } from '@/lib/hooks/use-formatted-throughput';

function resolutionToMilliseconds(
  resolution: number,
  period: {
    from: string;
    to: string;
  }
) {
  const distanceInMinutes = (new Date(period.to).getTime() - new Date(period.from).getTime()) / 1000 / 60;

  return Math.round(distanceInMinutes / resolution) * 1000 * 60;
}

/**
 * Adds missing samples to left and right sides of the series. We end up with a smooooooth chart
 */
function fullSeries(
  data: Array<[string, number]>,
  interval: number,
  period: {
    from: string;
    to: string;
  }
): Array<[string, number]> {
  if (!data.length) {
    return createEmptySeries({ interval, period });
  }

  // Find the first sample
  const firstSample = new Date(data[0][0]).getTime();
  // Find the last sample
  const lastSample = new Date(data[data.length - 1][0]).getTime();
  // Turn period.from to a number
  const startAt = new Date(period.from).getTime();
  // Turn period.to to a number
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
  const newData: Array<[string, number]> = [];

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
  for (const i = 0; i < amount; amount++) {
    items[i] = f(i);
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
}): Array<[string, number]> {
  const startAt = new Date(period.from).getTime();
  const endAt = new Date(period.to).getTime();

  const steps = Math.floor((endAt - startAt) / interval);
  return times(steps, i => [new Date(startAt + i * interval).toISOString(), 0]);
}

function useChartStyles() {
  return useColorModeValue(
    {
      backgroundColor: '#fff',
      textStyle: {
        color: '#52525b',
      },
      legend: {
        textStyle: {
          color: '#52525b',
        },
      },
    },
    {
      backgroundColor: 'transparent',
      textStyle: {
        color: '#fff',
      },
      legend: {
        textStyle: {
          color: '#fff',
        },
      },
    }
  );
}

const Stats = {
  Root: tw.div`text-center`,
  Value: tw.h2`font-normal text-3xl text-gray-900 dark:text-white`,
  Title: tw.p`text-sm leading-relaxed`,
};

const RequestsStats: React.FC<{ requests: number }> = ({ requests }) => {
  const value = useFormattedNumber(requests);

  return (
    <Stats.Root>
      <Stats.Value>{value}</Stats.Value>
      <Stats.Title>Requests</Stats.Title>
    </Stats.Root>
  );
};

const UniqueOperationsStats: React.FC<{ operations: number }> = ({ operations }) => {
  const value = useFormattedNumber(operations);

  return (
    <Stats.Root>
      <Stats.Value>{value}</Stats.Value>
      <Stats.Title>Unique Operations</Stats.Title>
    </Stats.Root>
  );
};

const PercentileStats: React.FC<{ value: number; title: string }> = ({ value, title }) => {
  const formatted = useFormattedDuration(value);

  return (
    <Stats.Root>
      <Stats.Value>{formatted}</Stats.Value>
      <Stats.Title>{title}</Stats.Title>
    </Stats.Root>
  );
};

const RPM: React.FC<{
  requests: number;
  period: {
    from: string;
    to: string;
  };
}> = ({ period, requests }) => {
  const throughput = useFormattedThroughput({
    requests,
    window: new Date(period.to).getTime() - new Date(period.from).getTime(),
  });
  return (
    <Stats.Root>
      <Stats.Value>{throughput}</Stats.Value>
      <Stats.Title>RPM</Stats.Title>
    </Stats.Root>
  );
};

const SuccessRateStats: React.FC<{
  requests: number;
  totalFailures: number;
}> = ({ requests, totalFailures }) => {
  const rate = requests || totalFailures ? `${toDecimal(((requests - totalFailures) * 100) / requests)}%` : '-';

  return (
    <Stats.Root>
      <Stats.Value tw="text-emerald-500 dark:text-emerald-500">{rate}</Stats.Value>
      <Stats.Title>Success rate</Stats.Title>
    </Stats.Root>
  );
};

const FailureRateStats: React.FC<{
  requests: number;
  totalFailures: number;
}> = ({ requests, totalFailures }) => {
  const rate = requests || totalFailures ? `${toDecimal((totalFailures * 100) / requests)}%` : '-';

  return (
    <Stats.Root tw="pt-4">
      <Stats.Value tw="text-red-500 dark:text-red-500">{rate}</Stats.Value>
      <Stats.Title>Failure rate</Stats.Title>
    </Stats.Root>
  );
};

const OverTimeStats: React.FC<{
  period: DateRangeInput;
  resolution: number;
  requestsOverTime: GeneralOperationsStatsQuery['operationsStats']['requestsOverTime'];
  failuresOverTime: GeneralOperationsStatsQuery['operationsStats']['failuresOverTime'];
}> = ({ period, resolution, requestsOverTime, failuresOverTime }) => {
  const styles = useChartStyles();
  const interval = resolutionToMilliseconds(resolution, period);
  const requests = React.useMemo(() => {
    if (requestsOverTime?.length) {
      return fullSeries(
        requestsOverTime.map<[string, number]>(node => [node.date, node.value]),
        interval,
        period
      );
    }

    return createEmptySeries({ interval, period });
  }, [requestsOverTime, interval, period]);

  const failures = React.useMemo(() => {
    if (failuresOverTime?.length) {
      return fullSeries(
        failuresOverTime.map<[string, number]>(node => [node.date, node.value]),
        interval,
        period
      );
    }

    return createEmptySeries({ interval, period });
  }, [failuresOverTime, interval, period]);

  return (
    <div className="rounded-md bg-gray-900/50 p-5 ring-1 ring-gray-800">
      <Section.Title>Operations over time</Section.Title>
      <Section.Subtitle>Timeline of GraphQL requests and failures</Section.Subtitle>
      <AutoSizer disableHeight>
        {size => (
          <ReactECharts
            style={{ width: size.width, height: 200 }}
            theme={theme.theme}
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
                },
                {
                  type: 'value',
                  min: 0,
                },
              ],
              series: [
                {
                  type: 'line',
                  name: 'Requests',
                  showSymbol: false,
                  smooth: true,
                  color: 'rgb(234, 179, 8)',
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
                  smooth: true,
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
};

const ClientsStats: React.FC<{
  clients: GeneralOperationsStatsQuery['operationsStats']['clients']['nodes'];
}> = ({ clients }) => {
  const styles = useChartStyles();
  const sortedClients = React.useMemo(() => {
    return clients?.length ? clients.slice().sort((a, b) => b.count - a.count) : [];
  }, [clients]);
  const byClient = React.useMemo(() => {
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
        } else {
          if (!labels[4]) {
            counts.push(client.count);
            labels.push(sortedClients.length === 5 ? client.name : `Other clients (${sortedClients.length - 4})`);
          } else {
            counts[4] += client.percentage;
          }
        }
      }

      values = counts.map(value => toDecimal((value * 100) / total));
    }

    return {
      labels,
      values,
    };
  }, [sortedClients]);

  const byVersion = React.useMemo(() => {
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
        } else {
          if (!labels[4]) {
            counts.push(version.count);
            labels.push(versions.length === 5 ? version.name : `Other versions (${versions.length - 4})`);
          } else {
            counts[4] += version.count;
          }
        }
      }

      values = counts.map(value => toDecimal((value * 100) / total));
    }

    return {
      labels,
      values,
    };
  }, [sortedClients]);

  return (
    <div className="w-full rounded-md bg-gray-900/50 p-5 ring-1 ring-gray-800">
      <Section.Title>Clients</Section.Title>
      <Section.Subtitle>Top 5 - GraphQL API consumers</Section.Subtitle>
      <AutoSizer disableHeight className="mt-5 w-full">
        {size => {
          if (size.width === 0) {
            return null;
          }

          return (
            <div className="flex w-full flex-row gap-4">
              <ReactECharts
                style={{ width: size.width / 2, height: 200 }}
                theme={theme.theme}
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
                  },
                  yAxis: {
                    type: 'category',
                    data: byClient.labels,
                  },
                  series: [
                    {
                      type: 'bar',
                      data: byClient.values,
                      color: 'rgb(234, 179, 8)',
                    },
                  ],
                }}
              />
              <ReactECharts
                style={{ width: size.width / 2, height: 200 }}
                theme={theme.theme}
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
                  },
                  yAxis: {
                    type: 'category',
                    data: byVersion.labels,
                  },
                  series: [
                    {
                      type: 'bar',
                      data: byVersion.values,
                      color: 'rgb(234, 179, 8)',
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
};

const LatencyOverTimeStats: React.FC<{
  period: {
    from: string;
    to: string;
  };
  resolution: number;
  duration: GeneralOperationsStatsQuery['operationsStats']['durationOverTime'];
}> = ({ period, resolution, duration }) => {
  const styles = useChartStyles();
  const interval = resolutionToMilliseconds(resolution, period);
  const p75 = React.useMemo(() => {
    if (duration?.length) {
      return fullSeries(
        duration.map<[string, number]>(node => [node.date, node.duration.p75]),
        interval,
        period
      );
    }

    return createEmptySeries({ interval, period });
  }, [duration, interval, period]);
  const p90 = React.useMemo(() => {
    if (duration?.length) {
      return fullSeries(
        duration.map<[string, number]>(node => [node.date, node.duration.p90]),
        interval,
        period
      );
    }

    return createEmptySeries({ interval, period });
  }, [duration, interval, period]);
  const p95 = React.useMemo(() => {
    if (duration?.length) {
      return fullSeries(
        duration.map<[string, number]>(node => [node.date, node.duration.p95]),
        interval,
        period
      );
    }

    return createEmptySeries({ interval, period });
  }, [duration, interval, period]);
  const p99 = React.useMemo(() => {
    if (duration?.length) {
      return fullSeries(
        duration.map<[string, number]>(node => [node.date, node.duration.p99]),
        interval,
        period
      );
    }

    return createEmptySeries({ interval, period });
  }, [duration, interval, period]);

  const xAxis = [
    {
      type: 'time',
      boundaryGap: false,
    },
  ];

  const yAxis = [
    {
      type: 'value',
      min: 0,
    },
  ];

  function createSeries(name: string, color: string, data: [string, number][]) {
    return {
      name,
      type: 'line',
      smooth: true,
      showSymbol: false,
      color,
      emphasis: {
        focus: 'series',
      },
      large: true,
      data,
    };
  }

  const series = [
    createSeries('p75', '#10b981', p75),
    createSeries('p90', '#06b6d4', p90),
    createSeries('p95', '#6366f1', p95),
    createSeries('p99', '#ec4899', p99),
  ];

  const legends = series.map(s => s.name);
  const colors = series.map(s => s.color);

  return (
    <div className="rounded-md bg-gray-900/50 p-5 ring-1 ring-gray-800">
      <Section.Title>Latency over time</Section.Title>
      <Section.Subtitle>Timeline of latency of GraphQL Operations</Section.Subtitle>
      <AutoSizer disableHeight>
        {size => (
          <ReactECharts
            style={{ width: size.width, height: 200 }}
            theme={theme.theme}
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
              color: colors,
              legend: {
                ...styles.legend,
                data: legends,
              },
              xAxis,
              yAxis,
              series,
            }}
          />
        )}
      </AutoSizer>
    </div>
  );
};

const RpmOverTimeStats: React.FC<{
  period: {
    from: string;
    to: string;
  };
  resolution: number;
  requestsOverTime: GeneralOperationsStatsQuery['operationsStats']['requestsOverTime'];
}> = ({ period, resolution, requestsOverTime }) => {
  const styles = useChartStyles();
  const requests = requestsOverTime ?? [];

  const interval = resolutionToMilliseconds(resolution, period);
  const windowInM = interval / (60 * 1000);
  const rpmOverTime = React.useMemo(() => {
    if (requests.length) {
      return fullSeries(
        requests.map<[string, number]>(node => [node.date, parseFloat((node.value / windowInM).toFixed(4))]),
        interval,
        period
      );
    }

    return createEmptySeries({ interval, period });
  }, [requests, interval, period, windowInM]);

  return (
    <div className="rounded-md bg-gray-900/50 p-5 ring-1 ring-gray-800">
      <Section.Title>RPM over time</Section.Title>
      <Section.Subtitle>Timeline of GraphQL requests and failures</Section.Subtitle>
      <AutoSizer disableHeight>
        {size => (
          <ReactECharts
            style={{ width: size.width, height: 200 }}
            theme={theme.theme}
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
                  boundaryGap: false,
                  min: 0,
                  axisLabel: {
                    formatter: (value: number) => formatThroughput(value * 10, interval),
                  },
                },
              ],
              series: [
                {
                  type: 'bar',
                  name: 'RPM',
                  symbol: 'none',
                  smooth: true,
                  areaStyle: {
                    color: 'rgb(234, 179, 8)',
                  },
                  lineStyle: {
                    color: 'rgb(234, 179, 8)',
                  },
                  color: 'rgb(234, 179, 8)',
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
};

const LatencyHistogramStats: React.FC<{
  organization: string;
  project: string;
  target: string;
  period: {
    from: string;
    to: string;
  };
  operationsFilter: string[];
}> = ({ organization, project, target, period, operationsFilter }) => {
  const styles = useChartStyles();
  const [query] = useQuery({
    query: DurationHistogramDocument,
    variables: {
      selector: {
        organization,
        project,
        target,
        period,
        operations: operationsFilter,
      },
      resolution: 90,
    },
  });

  const histogram = query.data?.operationsStats?.durationHistogram ?? [];

  const durationHistogram = React.useMemo(() => {
    if (histogram.length) {
      return histogram.map(node => [node.duration, node.count]);
    }

    return [];
  }, [histogram]);

  const min = histogram.length ? durationHistogram[0][0] : 1;
  const max = histogram.length ? durationHistogram[durationHistogram.length - 1][0] : 10_000;
  const totalRequests = durationHistogram.reduce((sum, node) => node[1] + sum, 0);

  return (
    <div className="rounded-md bg-gray-900/50 p-5 ring-1 ring-gray-800">
      <Section.Title>Latency histogram</Section.Title>
      <Section.Subtitle>Distribution of duration of all GraphQL requests</Section.Subtitle>
      <AutoSizer disableHeight>
        {size => (
          <ReactECharts
            style={{ width: size.width, height: 200 }}
            theme={theme.theme}
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
                trigger: 'axis',
                formatter([record]: [{ data: [number, number] }]) {
                  const [duration, count] = record.data;
                  const percentage = toDecimal((count * 100) / totalRequests);

                  return `${formatDuration(duration, true)} - ${formatNumber(count)} requests ${percentage}%`;
                },
              },
              xAxis: [
                {
                  type: 'log',
                  scale: true,
                  min,
                  max,
                  axisLabel: {
                    formatter: (value: number) => formatDuration(value, true),
                  },
                },
              ],
              yAxis: [{ type: 'value', min: 0 }],
              series: [
                {
                  type: 'bar',
                  name: 'Request Duration',
                  symbol: 'none',
                  color: 'rgb(234, 179, 8)',
                  areaStyle: {},
                  barMaxWidth: 5,
                  large: true,
                  data: durationHistogram,
                },
              ],
            }}
          />
        )}
      </AutoSizer>
    </div>
  );
};

export const OperationsStats: React.FC<{
  organization: string;
  project: string;
  target: string;
  period: {
    from: string;
    to: string;
  };
  operationsFilter: string[];
}> = ({ organization, project, target, period, operationsFilter }) => {
  const resolution = 90;
  const [query] = useQuery({
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

  const stats = query.data?.operationsStats;

  const totalRequests = stats?.totalRequests;
  const totalFailures = stats?.totalFailures;

  return (
    <section
      tw="text-gray-600 dark:text-gray-400 space-y-12 transition-opacity ease-in-out duration-700"
      style={{
        opacity: query.fetching ? 0.5 : 1,
      }}
    >
      <Grid
        templateRows="repeat(2, 1fr)"
        templateColumns="repeat(4, 1fr)"
        gap={4}
        tw="rounded-md p-5 ring-1 ring-gray-800 transition bg-gray-900/50"
      >
        <GridItem>
          <RequestsStats requests={totalRequests} />
        </GridItem>
        <GridItem>
          <RPM requests={totalRequests} period={period} />
        </GridItem>
        <GridItem>
          <UniqueOperationsStats operations={stats?.totalOperations} />
        </GridItem>

        <GridItem rowSpan={2}>
          <SuccessRateStats requests={totalRequests} totalFailures={totalFailures} />
          <FailureRateStats requests={totalRequests} totalFailures={totalFailures} />
        </GridItem>

        <GridItem>
          <PercentileStats value={stats?.duration?.p90} title="Latency p90" />
        </GridItem>
        <GridItem>
          <PercentileStats value={stats?.duration?.p95} title="Latency p95" />
        </GridItem>
        <GridItem>
          <PercentileStats value={stats?.duration?.p99} title="Latency p99" />
        </GridItem>
      </Grid>
      <div>
        <ClientsStats clients={stats?.clients?.nodes} />
      </div>
      <div>
        <OverTimeStats
          period={period}
          resolution={resolution}
          requestsOverTime={stats?.requestsOverTime}
          failuresOverTime={stats?.failuresOverTime}
        />
      </div>
      <div>
        <RpmOverTimeStats period={period} resolution={resolution} requestsOverTime={stats?.requestsOverTime} />
      </div>
      <div>
        <LatencyOverTimeStats period={period} duration={stats?.durationOverTime} resolution={resolution} />
      </div>
      <div>
        <LatencyHistogramStats
          organization={organization}
          project={project}
          target={target}
          period={period}
          operationsFilter={operationsFilter}
        />
      </div>
    </section>
  );
};
