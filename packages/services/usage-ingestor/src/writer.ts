import * as Sentry from '@sentry/node';
import { got } from 'got';
import Agent from 'agentkeepalive';
import { compress } from '@hive/usage-common';
import { operationsOrder, registryOrder, joinIntoSingleMessage } from './serializer';

export interface ClickHouseConfig {
  protocol: string;
  host: string;
  port: number;
  username: string;
  password: string;
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
  maxSockets: 35,
  maxFreeSockets: 10,
  scheduling: 'lifo',
};

export function createWriter({ clickhouse }: { clickhouse: ClickHouseConfig }) {
  const httpAgent = new Agent(agentConfig);
  const httpsAgent = new Agent.HttpsAgent(agentConfig);

  const agents = {
    http: httpAgent,
    https: httpsAgent,
  };

  return {
    async writeOperations(operations: string[]) {
      const csv = joinIntoSingleMessage(operations);

      await writeCsv(
        clickhouse,
        agents,
        `INSERT INTO operations_new (${operationsFields}) FORMAT CSV`,
        await compress(csv)
      );
    },
    async writeRegistry(records: string[]) {
      const csv = joinIntoSingleMessage(records);
      await writeCsv(
        clickhouse,
        agents,
        `INSERT INTO operations_registry (${registryFields}) FORMAT CSV`,
        await compress(csv)
      );
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
  body: Buffer
) {
  return got
    .post(`${config.protocol ?? 'https'}://${config.host}:${config.port}`, {
      body,
      searchParams: {
        query,
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
          if (info.attemptCount >= 5) {
            // After 5 retries, stop.
            return 0;
          }

          return info.attemptCount * 250;
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
    .catch(error => {
      Sentry.captureException(error, {
        level: 'error',
        extra: {
          query,
        },
      });
      return Promise.reject(error);
    });
}
