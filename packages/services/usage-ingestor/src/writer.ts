import Agent from 'agentkeepalive';
import { got, Response as GotResponse } from 'got';
import type { ServiceLogger } from '@hive/service-common';
import { compress } from '@hive/usage-common';
import * as Sentry from '@sentry/node';
import { writeDuration } from './metrics';
import {
  joinIntoSingleMessage,
  operationsOrder,
  registryOrder,
  subscriptionOperationsOrder,
} from './serializer';

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
const subscriptionOperationsFields = subscriptionOperationsOrder.join(', ');
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

export function createWriter({
  clickhouse,
  logger,
}: {
  clickhouse: ClickHouseConfig;
  logger: ServiceLogger;
}) {
  const httpAgent = new Agent(agentConfig);
  const httpsAgent = new Agent.HttpsAgent(agentConfig);

  const agents = {
    http: httpAgent,
    https: httpsAgent,
  };

  return {
    async writeOperations(operations: string[]) {
      if (operations.length === 0) {
        return;
      }

      const csv = joinIntoSingleMessage(operations);
      const compressed = await compress(csv);

      await writeCsv(
        clickhouse,
        agents,
        `INSERT INTO operations (${operationsFields}) FORMAT CSV`,
        compressed,
        logger,
        3,
      );
    },
    async writeSubscriptionOperations(operations: string[]) {
      if (operations.length === 0) {
        return;
      }

      const csv = joinIntoSingleMessage(operations);
      const compressed = await compress(csv);

      await writeCsv(
        clickhouse,
        agents,
        `INSERT INTO subscription_operations (${subscriptionOperationsFields}) FORMAT CSV`,
        compressed,
        logger,
        3,
      );
    },
    async writeRegistry(records: string[]) {
      if (records.length === 0) {
        return;
      }

      const csv = joinIntoSingleMessage(records);
      const compressed = await compress(csv);

      await writeCsv(
        clickhouse,
        agents,
        `INSERT INTO operation_collection (${registryFields}) FORMAT CSV`,
        compressed,
        logger,
        3,
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
  logger: ServiceLogger,
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
