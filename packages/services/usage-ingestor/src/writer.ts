import Agent from 'agentkeepalive';
import { got, Response as GotResponse } from 'got';
import type { FastifyLoggerInstance } from '@hive/service-common';
import { compress } from '@hive/usage-common';
import * as Sentry from '@sentry/node';
import { writeDuration } from './metrics';
import { joinIntoSingleMessage, operationsOrder, registryOrder } from './serializer';

export interface ClickHouseConfig {
  protocol: string;
  host: string;
  port: number;
  username: string;
  password: string;
  async_insert_busy_timeout_ms: number;
  async_insert_max_data_size: number;
}

const operationsFields = operationsOrder.join(', ');
const registryFields = registryOrder.join(', ');

const agentConfig: Agent.HttpOptions = {
  // Keep sockets around in a pool to be used by other requests in the future
  keepAlive: true,
  // Sets the working socket to timeout after N ms of inactivity on the working socket
  timeout: 60_000,
  // Sets the free socket to timeout after N ms of inactivity on the free socket
  freeSocketTimeout: 30_000,
  // Sets the socket active time to live
  socketActiveTTL: 60_000,
  maxSockets: 10,
  maxFreeSockets: 10,
  scheduling: 'lifo',
};

function isQueryResponse<T>(response: unknown): response is {
  data: readonly T[];
} {
  return (
    typeof response === 'object' &&
    response !== null &&
    'data' in response &&
    Array.isArray((response as { data: unknown }).data)
  );
}

export function createWriter({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouseConfig;
  logger: FastifyLoggerInstance;
}) {
  const httpAgent = new Agent(agentConfig);
  const httpsAgent = new Agent.HttpsAgent(agentConfig);

  const agents = {
    http: httpAgent,
    https: httpsAgent,
  };

  async function fetchTableNames() {
    const query = `SELECT name FROM system.tables WHERE database = 'default'`;
    const response = await got
      .post(`${clickhouse.protocol ?? 'https'}://${clickhouse.host}:${clickhouse.port}`, {
        body: query,
        username: clickhouse.username,
        password: clickhouse.password,
        headers: {
          Accept: 'application/json',
        },
        searchParams: {
          default_format: 'JSON',
          wait_end_of_query: '1',
        },
        timeout: {
          lookup: 2000,
          connect: 2000,
          secureConnect: 2000,
          request: 30_000,
        },
        agent: {
          http: agents.http,
          https: agents.https,
        },
        responseType: 'json',
      })
      .then(response => response.body)
      .catch(error => {
        Sentry.captureException(error, {
          level: 'error',
          tags: {
            clickhouse_host: clickhouse.host,
          },
          extra: {
            query,
            clickhouse: {
              protocol: clickhouse.protocol,
              host: clickhouse.host,
              port: clickhouse.port,
            },
          },
        });
        return Promise.reject(error);
      });

    if (isQueryResponse<{ name: string }>(response)) {
      return new Set(response.data.map(row => row.name));
    }

    throw new Error('Unexpected response from ClickHouse (queryId: fetchTableNames)');
  }

  return {
    async writeOperations(operations: string[], migrationSpecificOperations: string[]) {
      if (operations.length === 0) {
        return;
      }

      const tableNames = await fetchTableNames();

      if (!tableNames.has('operations')) {
        throw new Error('Missing operations table');
      }

      const shouldUsePartialOperations =
        tableNames.has('operations') && tableNames.has('operations_new') ? true : false;

      if (shouldUsePartialOperations) {
        logger.debug(
          'Using partial records for operations (originalSize: %s, partialSize: %s)',
          operations.length,
          migrationSpecificOperations.length ?? '0',
        );
        await Promise.all([
          // operations
          writeCsv(
            clickhouse,
            agents,
            `INSERT INTO operations (${operationsFields}) FORMAT CSV`,
            await compress(joinIntoSingleMessage(operations)),
            logger,
            3,
          ),
          // operations_new
          migrationSpecificOperations.length > 0
            ? writeCsv(
                clickhouse,
                agents,
                `INSERT INTO operations_new (${operationsFields}) FORMAT CSV`,
                await compress(joinIntoSingleMessage(migrationSpecificOperations)),
                logger,
                3,
              )
            : Promise.resolve(),
        ]);
        return;
      }

      const tablesToWriteTo =
        tableNames.has('operations') && tableNames.has('operations_old')
          ? ['operations', 'operations_old']
          : ['operations'];

      const csv = joinIntoSingleMessage(operations);
      const compressed = await compress(csv);

      await Promise.all(
        tablesToWriteTo.map(async table => {
          const sql = `INSERT INTO ${table} (${operationsFields}) FORMAT CSV`;
          await writeCsv(clickhouse, agents, sql, compressed, logger, 3);
        }),
      );
    },
    async writeRegistry(records: string[], migrationSpecificRecords: string[]) {
      if (records.length === 0) {
        return;
      }

      const tableNames = await fetchTableNames();

      if (!tableNames.has('operation_collection')) {
        throw new Error('Missing operation_collection table');
      }

      const shouldUsePartialRecords =
        tableNames.has('operation_collection') && tableNames.has('operation_collection_new')
          ? true
          : false;

      if (shouldUsePartialRecords) {
        logger.debug(
          'Using partial records for operation_collection (originalSize: %s, partialSize: %s)',
          records.length,
          migrationSpecificRecords.length ?? '0',
        );
        await Promise.all([
          // operation_collection
          writeCsv(
            clickhouse,
            agents,
            `INSERT INTO operation_collection (${registryFields}) FORMAT CSV`,
            await compress(joinIntoSingleMessage(records)),
            logger,
            3,
          ),
          // operation_collection_new
          migrationSpecificRecords.length > 0
            ? writeCsv(
                clickhouse,
                agents,
                `INSERT INTO operation_collection_new (${registryFields}) FORMAT CSV`,
                await compress(joinIntoSingleMessage(migrationSpecificRecords)),
                logger,
                3,
              )
            : Promise.resolve(),
        ]);
        return;
      }

      const tablesToWriteTo =
        tableNames.has('operation_collection') && tableNames.has('operation_collection_old')
          ? ['operation_collection', 'operation_collection_old']
          : ['operation_collection'];

      const csv = joinIntoSingleMessage(records);
      const compressed = await compress(csv);

      await Promise.all(
        tablesToWriteTo.map(async table => {
          const sql = `INSERT INTO ${table} (${registryFields}) FORMAT CSV`;
          await writeCsv(clickhouse, agents, sql, compressed, logger, 3);
        }),
      );
    },
    destroy() {
      httpAgent.destroy();
      httpsAgent.destroy();
    },
  };
}

async function writeCsv(
  config: ClickHouseConfig,
  agents: {
    http: Agent;
    https: Agent.HttpsAgent;
  },
  query: string,
  body: Buffer,
  logger: FastifyLoggerInstance,
  maxRetry: number,
) {
  const stopTimer = writeDuration.startTimer({
    query,
    destination: config.host,
  });
  return got
    .post(`${config.protocol ?? 'https'}://${config.host}:${config.port}`, {
      body,
      searchParams: {
        query,
        async_insert: 1,
        wait_for_async_insert: 0,
        async_insert_busy_timeout_ms: config.async_insert_busy_timeout_ms,
        async_insert_max_data_size: config.async_insert_max_data_size,
      },
      username: config.username,
      password: config.password,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'text/csv',
        'Content-Encoding': 'gzip',
      },
      retry: {
        calculateDelay(info) {
          if (info.attemptCount >= maxRetry) {
            logger.warn(
              'Exceeded the retry limit (%s/%s) for %s',
              info.attemptCount,
              maxRetry,
              query,
            );
            // After N retries, stop.
            return 0;
          }

          logger.debug('Retry %s/%s for %s', info.attemptCount, maxRetry, query);

          return info.attemptCount * 500;
        },
      },
      timeout: {
        lookup: 2000,
        connect: 2000,
        secureConnect: 2000,
        request: 30_000,
      },
      agent: {
        http: agents.http,
        https: agents.https,
      },
    })
    .then(response => {
      stopTimer({
        status: response.statusCode,
      });
      return response;
    })
    .catch(error => {
      stopTimer({
        status: getStatusCodeFromError(error) ?? 'unknown',
      });
      Sentry.captureException(error, {
        level: 'error',
        tags: {
          clickhouse_host: config.host,
        },
        extra: {
          query,
          clickhouse: {
            protocol: config.protocol,
            host: config.host,
            port: config.port,
          },
        },
      });
      return Promise.reject(error);
    });
}

function hasResponse(error: unknown): error is {
  response: GotResponse;
} {
  return error instanceof Error && 'response' in error && typeof error.response === 'object';
}

function getStatusCodeFromError(error: unknown) {
  if (hasResponse(error)) {
    return error.response?.statusCode;
  }
}
