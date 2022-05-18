import type { FastifyLoggerInstance } from '@hive/service-common';
import { createStorage as createPostgreSQLStorage } from '@hive/storage';
import { HttpClient, ClickHouse, OperationsReader } from '@hive/api';

export type Estimator = ReturnType<typeof createEstimator>;

export function createEstimator(config: {
  logger: FastifyLoggerInstance;
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
        elapsedSeconds: number;
      }
    ) => void;
  };
  storage: {
    connectionString: string;
  };
}) {
  const { logger } = config;
  const postgres$ = createPostgreSQLStorage(config.storage.connectionString);
  const httpClient = new HttpClient();
  const clickhouse = new ClickHouse(
    config.clickhouse,
    httpClient,
    config.logger
  );
  const operationsReader = new OperationsReader(clickhouse);

  return {
    readiness() {
      return true;
    },
    async start() {
      logger.info('Usage Estimator starting');
    },
    async stop() {
      logger.info('Usage Reported stopped');
    },
    async estimateSchemaPushesForTargets(input: {
      targets: string[];
      startTime: Date;
      endTime: Date;
    }): Promise<{ count: number }> {
      const storage = await postgres$;
      const response = await storage.getSchemaPushCount({
        targetIds: input.targets,
        startTime: input.startTime,
        endTime: input.endTime,
      });

      return {
        count: response,
      };
    },
    async estimateSchemaPushesForAllTargets(input: {
      startTime: Date;
      endTime: Date;
    }) {
      const storage = await postgres$;
      const response = await storage.getAllSchemaPushesGrouped({
        startTime: input.startTime,
        endTime: input.endTime,
      });

      return response;
    },
    async estimateOperationsForAllTargets(input: {
      startTime: Date;
      endTime: Date;
    }) {
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
        query: `
      SELECT
        target,
        sum(total) as total
      FROM operations_new_hourly_mv
       ${filter}
      GROUP BY target
    `,
        queryId: 'usage_estimator_count_operations_all',
        timeout: 60_000,
      });
    },
    async estimateCollectedOperationsForTargets(input: {
      targets: string[];
      startTime: Date;
      endTime: Date;
    }) {
      const filter = operationsReader.createFilter({
        target: input.targets,
        period: {
          from: input.startTime,
          to: input.endTime,
        },
      });

      return await clickhouse.query<{
        total: string;
      }>({
        query: `
      SELECT 
        sum(total) as total
      FROM operations_new_hourly_mv
      ${filter}
    `,
        queryId: 'usage_estimator_count_operations',
        timeout: 15_000,
      });
    },
  };
}
