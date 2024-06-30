import { createHash } from 'node:crypto';
import Agent from 'agentkeepalive';
import { Inject, Injectable } from 'graphql-modules';
import { SpanKind, trace } from '@hive/service-common';
import { castValue, compress } from '@hive/usage-common';
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
  statistics?: {
    elapsed: number;
  };

  exception?: string;
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
  private tracer: ReturnType<(typeof trace)['getTracer']>;
  private endpoint: string;

  constructor(
    @Inject(CLICKHOUSE_CONFIG) private config: ClickHouseConfig,
    private httpClient: HttpClient,
    logger: Logger,
  ) {
    this.tracer = trace.getTracer('clickhouse-client');
    this.logger = logger.child({
      service: 'ClickHouse',
    });
    this.endpoint = `${this.config.protocol ?? 'https'}://${this.config.host}:${this.config.port}`;
  }

  @atomic(({ query }: { query: SqlStatement }) => hashQuery(query))
  async query<T = unknown>({
    query,
    queryId,
    timeout,
  }: {
    query: SqlStatement;
    queryId: string;
    timeout: number;
  }): Promise<QueryResponse<T>> {
    const startedAt = Date.now();
    const executionId = queryId + '-' + Math.random().toString(16).substring(2);
    const span = this.tracer.startSpan(`ClickHouse: ${queryId}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.type': 'ClickHouse',
        'db.query': query.sql,
        'db.query.id': queryId,
        'execution.id': executionId,
      },
    });
    this.logger.debug(
      `Executing ClickHouse Query (executionId: %s): %s`,
      executionId,
      printWithValues(query).replace(/\n/g, ' ').replace(/\s+/g, ' '),
    );

    let retries = 0;

    const response = await this.httpClient
      .post<QueryResponse<T>>(
        this.endpoint,
        {
          body: query.sql,
          headers: {
            'Accept-Encoding': 'gzip',
            Accept: 'application/json',
          },
          searchParams: {
            default_format: 'JSON',
            // Max execution time in seconds
            max_execution_time: (this.config.requestTimeout ?? timeout) / 1000,
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
            // override the provided timeout of a query with the globally configured timeout
            request: this.config.requestTimeout ?? timeout,
          },
          retry: {
            calculateDelay: info => {
              span.setAttribute('retry.count', info.attemptCount);

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
          hooks: {
            // `beforeRetry` runs first, then `beforeRequest`
            beforeRequest: [
              options => {
                if (
                  retries > 0 &&
                  options.searchParams &&
                  typeof options.searchParams === 'object' &&
                  'query_id' in options.searchParams &&
                  typeof options.searchParams.query_id === 'string'
                ) {
                  // We do it to avoid QUERY_WITH_SAME_ID_IS_ALREADY_RUNNING error in ClickHouse
                  // Context: https://clickhouse.com/docs/en/interfaces/http
                  // > Running requests do not stop automatically if the HTTP connection is lost.
                  // > The optional 'query_id' parameter can be passed as the query ID (any string).
                  // More context: https://clickhouse.com/docs/en/operations/settings/settings#replace-running-query
                  // > When using the HTTP interface, the 'query_id' parameter can be passed.
                  // > If a query from the same user with the same 'query_id' already exists at this time,
                  // > the behaviour depends on the 'replace_running_query' parameter.
                  // > Default: throws QUERY_WITH_SAME_ID_IS_ALREADY_RUNNING exception.
                  options.searchParams.query_id = options.searchParams.query_id.replace(
                    /-r\d$/,
                    '-r' + retries,
                  );
                }
              },
            ],
            beforeRetry: [
              (_, retryCount) => {
                retries = retryCount;
              },
            ],
          },
        },
        span,
      )
      .then(response => {
        if (response.exception) {
          throw new Error(response.exception);
        }
        return response;
      })
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
        this.logger.debug(
          `Finished ClickHouse Query (executionId: %s, duration=%sms)`,
          executionId,
          Date.now() - startedAt,
        );
      });
    const endedAt = (Date.now() - startedAt) / 1000;
    this.config.onReadEnd?.(queryId, {
      totalSeconds: endedAt,
      elapsedSeconds: response.statistics?.elapsed,
    });

    return response;
  }

  /** Please insert data with this function :) */
  async insert(args: {
    query: SqlStatement;
    queryId: string;
    data: unknown[][];
    timeout: number;
  }): Promise<void> {
    const startedAt = Date.now();
    const executionId = args.queryId + '-' + Math.random().toString(16).substring(2);
    const span = this.tracer.startSpan(`ClickHouse Insert: ${args.queryId}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.type': 'ClickHouse',
        'db.query': args.query.sql,
        'db.query.id': args.queryId,
        'execution.id': executionId,
      },
    });
    this.logger.debug(
      `Executing ClickHouse Query (executionId: %s): %s`,
      executionId,
      args.query.sql.replace(/\n/g, ' ').replace(/\s+/g, ' '),
    );

    const maxRetry = 5;

    await this.httpClient
      .post(
        this.endpoint,
        {
          body: await compress(
            args.data.map(row => row.map(value => castValue(value)).join(',')).join('\n'),
          ),
          searchParams: {
            query: args.query.sql,
            async_insert: 1,
            wait_for_async_insert: 1,
          },
          username: this.config.username,
          password: this.config.password,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'text/csv',
            'Content-Encoding': 'gzip',
          },
          retry: {
            calculateDelay: info => {
              if (info.attemptCount >= maxRetry) {
                this.logger.warn(
                  'Exceeded the retry limit (%s/%s) for %s',
                  info.attemptCount,
                  maxRetry,
                  args.query.sql,
                );
                // After N retries, stop.
                return 0;
              }

              this.logger.debug('Retry %s/%s for %s', info.attemptCount, maxRetry, args.query.sql);
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
            http: httpAgent,
            https: httpsAgent,
          },
        },
        span,
      )
      .catch(error => {
        this.logger.error(
          `Failed to run ClickHouse Insert query, executionId: %s, code: %s , error name: %s, message: %s`,
          executionId,
          error.code,
          error.name,
          error.message,
        );
        return Promise.reject(error);
      })
      .finally(() => {
        this.logger.debug(
          `Finished ClickHouse Insert Query (executionId: %s, duration=%sms)`,
          executionId,
          Date.now() - startedAt,
        );
      });
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
