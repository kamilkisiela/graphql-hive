import { metrics } from '@hive/service-common';

export const clickHouseReadDuration = new metrics.Histogram({
  name: 'api_clickhouse_read_duration',
  help: 'Read duration - ClickHouse',
  labelNames: ['query'],
});

export const clickHouseElapsedDuration = new metrics.Histogram({
  name: 'api_clickhouse_elapsed_duration',
  help: 'Read elapsed - ClickHouse',
  labelNames: ['query'],
});
