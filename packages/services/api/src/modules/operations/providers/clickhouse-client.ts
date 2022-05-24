import { Injectable, Inject } from 'graphql-modules';
import Agent from 'agentkeepalive';
import type { Span } from '@sentry/types';
import { CLICKHOUSE_CONFIG } from './tokens';
import type { ClickHouseConfig } from './tokens';
import { HttpClient } from '../../shared/providers/http-client';
import { atomic } from '../../../shared/helpers';
import { Logger } from '../../shared/providers/logger';

export interface QueryResponse<T> {
  data: readonly T[];
  rows: number;
  statistics: {
    elapsed: number;
  };
}

export type RowOf<T extends QueryResponse<any>> = T extends QueryResponse<infer R> ? R : never;

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

const httpAgent = new Agent(agentConfig);
const httpsAgent = new Agent.HttpsAgent(agentConfig);

@Injectable()
export class ClickHouse {
  private logger: Logger;

  constructor(
    @Inject(CLICKHOUSE_CONFIG) private config: ClickHouseConfig,
    private httpClient: HttpClient,
    logger: Logger
  ) {
    this.logger = logger.child({
      service: 'ClickHouse',
    });
  }

  @atomic(({ query }: { query: string }) => query)
  async query<T>({
    query,
    queryId,
    timeout,
    span: parentSpan,
  }: {
    query: string;
    queryId: string;
    timeout: number;
    span?: Span;
  }): Promise<QueryResponse<T>> {
    const span = parentSpan?.startChild({
      op: queryId,
    });
    const startedAt = Date.now();
    const endpoint = `${this.config.protocol ?? 'https'}://${this.config.host}:${this.config.port}`;

    this.logger.debug(`Executing ClickHouse Query: %s`, query);

    const response = await this.httpClient
      .post<QueryResponse<T>>(
        endpoint,
        {
          context: {
            description: `ClickHouse - ${queryId}`,
          },
          body: query,
          headers: {
            'Accept-Encoding': 'gzip',
            Accept: 'application/json',
          },
          searchParams: {
            default_format: 'JSON',
          },
          username: this.config.username,
          password: this.config.password,
          decompress: true,
          timeout: {
            lookup: 1000,
            connect: 1000,
            secureConnect: 1000,
            request: timeout,
          },
          retry: {
            calculateDelay: info => {
              if (info.attemptCount >= 6) {
                // After 5 retries, stop.
                return 0;
              }

              const delayBy = info.attemptCount * 250;

              this.logger.error(`Failed to run ClickHouse query, error is: ${JSON.stringify(info.error, null, 2)}`);

              this.logger.debug(
                `Retry (delay=%s, attempt=%s, reason=%s, queryId=%s)`,
                delayBy,
                info.attemptCount,
                info.error.message,
                queryId
              );

              return delayBy;
            },
          },
          responseType: 'json',
          agent: {
            http: httpAgent,
            https: httpsAgent,
          },
        },
        span
      )
      .finally(() => {
        span?.finish();
      });
    const endedAt = (Date.now() - startedAt) / 1000;

    this.config.onReadEnd?.(queryId, {
      totalSeconds: endedAt,
      elapsedSeconds: response.statistics.elapsed,
    });

    return response;
  }

  translateWindow({ value, unit }: { value: number; unit: 'd' | 'h' | 'm' }): string {
    const unitMap = {
      d: 'DAY',
      h: 'HOUR',
      m: 'MINUTE',
    };

    return `${value} ${unitMap[unit]}`;
  }
}
