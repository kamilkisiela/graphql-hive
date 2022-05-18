import { metrics } from '@hive/service-common';

export const clickHouseElapsedDuration = new metrics.Histogram({
  name: 'usage_estimation_clickhouse_elapsed_duration',
  help: 'Usage Estimation (ClickHouse/Read)',
  labelNames: ['query'],
});

export const clickHouseReadDuration = new metrics.Histogram({
  name: 'usage_estimation_clickhouse_read_duration',
  help: 'Usage Estimation (ClickHouse/Read Duration)',
  labelNames: ['query'],
});
