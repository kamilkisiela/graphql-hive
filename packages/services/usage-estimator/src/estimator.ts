import { ClickHouse, HttpClient, OperationsReader, sql } from '@hive/api';
import type { ServiceLogger } from '@hive/service-common';

export type Estimator = ReturnType<typeof createEstimator>;

export function createEstimator(config: {
  logger: ServiceLogger;
  clickhouse: {
    protocol: string;
    host: string;
    port: number;
    username: string;
    password: string;
    onReadEnd?: (
      label: string,
      timings: {
        totalSeconds: number;
        elapsedSeconds?: number;
      },
    ) => void;
  };
}) {
  const { logger } = config;
  const httpClient = new HttpClient();
  const clickhouse = new ClickHouse(config.clickhouse, httpClient, config.logger);
  const operationsReader = new OperationsReader(clickhouse, logger);

  return {
    readiness() {
      return true;
    },
    async start() {
      logger.info('Usage Estimator started');
    },
    async stop() {
      logger.info('Usage Estimator stopped');
    },
    async estimateOperationsForAllTargets(input: { startTime: Date; endTime: Date }) {
      const filter = operationsReader.createFilter({
        period: {
          from: input.startTime,
          to: input.endTime,
        },
      });

      return await clickhouse.query<{
        total: string;
        target: string;
      }>({
        query: sql`
          SELECT
            target,
            sum(total) as total
          FROM operations_hourly
          ${filter}
          GROUP BY target
        `,
        queryId: 'usage_estimator_count_operations_all',
        timeout: 60_000,
      });
    },
    // TODO: once 006 migration is done, delete this method
    async estimateCollectedOperationsForTargets(input: {
      targetIds: string[];
      month: number;
      year: number;
    }) {
      const startOfMonth = `${input.year}-${String(input.month).padStart(2, '0')}-01`;
      return await clickhouse.query<{
        total: string;
      }>({
        query: sql`
          SELECT 
            sum(total) as total
          FROM operations_hourly
          PREWHERE 
            target IN ${sql.array(input.targetIds, 'String')}
            AND timestamp >= toDateTime(${startOfMonth})
            AND timestamp < (toDateTime(${startOfMonth}) + INTERVAL 1 MONTH)
        `,
        queryId: 'usage_estimator_count_operations',
        timeout: 15_000,
      });
    },
    async estimateCollectedOperationsForOrganization(input: {
      organizationId: string;
      month: number;
      year: number;
    }) {
      const startOfMonth = `${input.year}-${String(input.month).padStart(2, '0')}-01`;
      return await clickhouse.query<{
        total: string;
      }>({
        query: sql`
          SELECT 
            sum(total) as total
          FROM monthly_overview
          PREWHERE organization = ${input.organizationId} AND date=${startOfMonth}
          GROUP BY organization
        `,
        queryId: 'usage_estimator_count_operations',
        timeout: 15_000,
      });
    },
  };
}
