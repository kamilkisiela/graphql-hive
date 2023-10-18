import { createHash } from 'node:crypto';
import Agent from 'agentkeepalive';
import { Inject, Injectable } from 'graphql-modules';
import type { Span } from '@sentry/types';
import { atomic } from '../../../shared/helpers';
import { HttpClient } from '../../shared/providers/http-client';
import { Logger } from '../../shared/providers/logger';
import { printWithValues, sql, SqlStatement, toQueryParams } from './sql';
import type { ClickHouseConfig } from './tokens';
import { CLICKHOUSE_CONFIG } from './tokens';

export { sql } from './sql';

function hashQuery(query: SqlStatement): string {
  return createHash('sha256').update(query.sql).update(JSON.stringify(query.values)).digest('hex');
}

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
  maxSockets: 32,
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
    logger: Logger,
  ) {
    this.logger = logger.child({
      service: 'ClickHouse',
    });
  }

  @atomic(({ query }: { query: SqlStatement }) => hashQuery(query))
  async query<T = unknown>({
    query,
    queryId,
    timeout,
    span: parentSpan,
  }: {
    query: SqlStatement;
    queryId: string;
    timeout: number;
    span?: Span;
  }): Promise<QueryResponse<T>> {
    const span = parentSpan?.startChild({
      op: queryId,
    });
    const startedAt = Date.now();
    const endpoint = `${this.config.protocol ?? 'https'}://${this.config.host}:${this.config.port}`;
    const executionId = queryId + '-' + Math.random().toString(16).substring(2);

    this.logger.debug(
      `Executing ClickHouse Query (executionId: %s): %s`,
      executionId,
      printWithValues(query).replace(/\n/g, ' ').replace(/\s+/g, ' '),
    );

    const response = await this.httpClient
      .post<QueryResponse<T>>(
        endpoint,
        {
          context: {
            description: `ClickHouse - ${queryId}`,
          },
          body: query.sql,
          headers: {
            'Accept-Encoding': 'gzip',
            Accept: 'application/json',
          },
          searchParams: {
            default_format: 'JSON',
            // Max execution time in seconds
            max_execution_time: timeout / 1000,
            query_id: executionId,
            ...toQueryParams(query),
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
              this.logger.error(
                `Failed to run ClickHouse query, executionId: %s, code: %s , error name: %s, message: %s`,
                executionId,
                info.error.code,
                info.error.name,
                info.error.message,
              );

              this.logger.debug(
                `Retry (delay=%s, attempt=%s, reason=%s, queryId=%s, executionId=%s)`,
                delayBy,
                info.attemptCount,
                info.error.message,
                queryId,
                executionId,
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

        span,
      )
      .catch(error => {
        this.logger.error(
          `Failed to run ClickHouse query, executionId: %s, code: %s , error name: %s, message: %s`,
          executionId,
          error.code,
          error.name,
          error.message,
        );
        return Promise.reject(error);
      })
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

  translateWindow({ value, unit }: { value: number; unit: 'd' | 'h' | 'm' }) {
    const unitMap = {
      d: 'DAY',
      h: 'HOUR',
      m: 'MINUTE',
    };

    return sql.raw(`${value} ${unitMap[unit]}`);
  }
}
