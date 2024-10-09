import { FastifyPluginCallback } from 'fastify';
import {
  FetchInstrumentation,
  type FetchInstrumentationConfig,
} from 'opentelemetry-instrumentation-fetch-node';
import type { Interceptor, Query, QueryContext } from 'slonik';
import zod from 'zod';
import {
  Attributes,
  AttributeValue,
  context,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  SpanKind,
  SpanStatusCode,
  trace,
  type Span,
} from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK, NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import { SamplingDecision } from '@opentelemetry/sdk-trace-base';
import {
  BatchSpanProcessor,
  ConsoleSpanExporter,
  Sampler,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import {
  SEMATTRS_HTTP_METHOD,
  SEMATTRS_HTTP_REQUEST_CONTENT_LENGTH,
  SEMATTRS_HTTP_RESPONSE_CONTENT_LENGTH,
  SEMATTRS_HTTP_ROUTE,
  SEMATTRS_HTTP_STATUS_CODE,
  SEMATTRS_HTTP_USER_AGENT,
  SEMRESATTRS_SERVICE_NAME,
} from '@opentelemetry/semantic-conventions';
import openTelemetryPlugin, { OpenTelemetryPluginOptions } from './fastify-tracing';

export { trace, context, Span, SpanKind, SamplingDecision, SpanStatusCode };

type Instrumentations = NodeSDKConfiguration['instrumentations'];

export class TracingInstance {
  private instrumentations: Instrumentations = [];
  private sdk: NodeSDK | undefined;

  constructor(
    private options: {
      collectorEndpoint: string;
      serviceName: string;
      enableConsoleExporter?: boolean;
      sampler?: Sampler['shouldSample'];
    },
  ) {
    console.info('🛣️ OpenTelemetry tracing enabled');
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
  }

  build(): TracingInstance {
    const httpExporter = new OTLPTraceExporter({ url: this.options.collectorEndpoint });
    const processor = new BatchSpanProcessor(httpExporter);
    const contextManager = new AsyncHooksContextManager();

    const sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: this.options.serviceName,
      }),
      resourceDetectors: [],
      contextManager,
      sampler: {
        shouldSample: (context, traceId, spanName, spanKind, attributes, links) => {
          if (
            attributes['http.client'] === 'fetch' &&
            attributes['http.target'] &&
            String(attributes['http.target']).includes('/heartbeat/')
          ) {
            return {
              decision: SamplingDecision.NOT_RECORD,
            };
          }

          if (this.options.sampler) {
            return this.options.sampler(context, traceId, spanName, spanKind, attributes, links);
          }

          return {
            decision: SamplingDecision.RECORD_AND_SAMPLED,
          };
        },
        toString: () => {
          return `${this.options.serviceName}-sampler`;
        },
      },
      spanProcessors: this.options.enableConsoleExporter
        ? [processor, new SimpleSpanProcessor(new ConsoleSpanExporter())]
        : [processor],
      instrumentations: this.instrumentations,
    });

    contextManager.enable();

    this.sdk = sdk;
    return this;
  }

  start() {
    if (!this.sdk) {
      throw new Error('Tracing instance not built yet.');
    }

    this.sdk.start();
  }

  traceProvider() {
    if (!this.sdk) {
      throw new Error('Tracing instance not built yet.');
    }

    return trace.getTracerProvider();
  }

  async shutdown() {
    if (!this.sdk) {
      throw new Error('Tracing instance not built yet.');
    }

    await this.sdk.shutdown();
  }

  instrumentSlonik(options: SlonikTracingInterceptorOptions = {}): Interceptor {
    return createSlonikInterceptor({
      shouldExcludeStatement: (_ctx, query) => {
        return (
          query.sql.includes('Heartbeat') ||
          query.sql === 'SELECT EXISTS(SELECT 1)' ||
          query.sql === 'SELECT 1' ||
          query.sql === '/* Heartbeat */ SELECT 1' ||
          query.sql === 'SELECT EXISTS( SELECT 1)'
        );
      },
      ...options,
    });
  }

  instrumentNodeFetch(config: FetchInstrumentationConfig = {}) {
    const serviceName = this.options.serviceName;
    const instance = new FetchInstrumentation({
      onRequest({ request, span, additionalHeaders }) {
        additionalHeaders['x-requesting-service'] = serviceName;

        if (request.path.startsWith('/trpc/')) {
          const url = new URL(request.origin + request.path);
          const trpcFunctionName = url.pathname.split('/').pop();
          span.setAttribute('trpc.function', trpcFunctionName || '');
          span.setAttribute('trpc.server', url.host);
          span.setAttribute('trpc.input', url.search);
          span.updateName(`tRPC: ${trpcFunctionName}`);
        }
      },
      ...config,
    });

    this.instrumentations.push(instance);
  }

  instrumentFastify(
    config?: OpenTelemetryPluginOptions,
  ): [FastifyPluginCallback<OpenTelemetryPluginOptions>, OpenTelemetryPluginOptions] {
    return [
      openTelemetryPlugin,
      {
        wrapRoutes: true,
        exposeApi: true,
        formatSpanName: request => `${request.method} ${request.url.split('?')[0]}`,
        formatSpanAttributes: {
          request: request => {
            const gqlClientHeaders: Record<string, AttributeValue> = {};
            const clientName =
              request.headers['graphql-client-name'] || request.headers['x-graphql-client-name'];
            const clientVersion =
              request.headers['graphql-client-version'] ||
              request.headers['x-graphql-client-version'];

            if (clientName) {
              gqlClientHeaders['graphql.client.name'] = clientName;
            }
            if (clientVersion) {
              gqlClientHeaders['graphql.client.version'] = clientVersion;
            }

            return {
              'request.id': request.headers['x-request-id'] || request.id,
              'cloudflare.ray.id': request.headers['cf-ray'],
              [SEMATTRS_HTTP_METHOD]: request.method,
              [SEMATTRS_HTTP_REQUEST_CONTENT_LENGTH]: request.headers['content-length'],
              [SEMATTRS_HTTP_ROUTE]: request.url,
              [SEMATTRS_HTTP_USER_AGENT]: request.headers['user-agent'],
              'requesting.service': request.headers['x-requesting-service'],
              ...gqlClientHeaders,
            };
          },
          reply: reply => ({
            [SEMATTRS_HTTP_STATUS_CODE]: reply.statusCode,
            [SEMATTRS_HTTP_RESPONSE_CONTENT_LENGTH]: reply.getHeader('content-length'),
          }),
          error: error => ({
            'error.type': error.name,
            'error.message': error.message,
            'error.stack': error.stack,
          }),
        },
        ignoreRoutes: (path, method) => {
          return (
            path === '/graphql?readiness=true' ||
            ['/_health', '/_readiness', '/api/health', '/health'].includes(path) ||
            method === 'OPTIONS'
          );
        },
        ...config,
      },
    ];
  }
}

export function configureTracing(options: ConstructorParameters<typeof TracingInstance>[0]) {
  return new TracingInstance(options);
}

// treat an empty string (`''`) as undefined
const emptyString = <T extends zod.ZodType>(input: T) => {
  return zod.preprocess((value: unknown) => {
    if (value === '') return undefined;
    return value;
  }, input);
};

export const OpenTelemetryConfigurationModel = zod.object({
  OPENTELEMETRY_COLLECTOR_ENDPOINT: emptyString(zod.string().url().optional()),
  OPENTELEMETRY_CONSOLE_EXPORTER: emptyString(zod.string().optional()),
});

export type SlonikTracingInterceptorOptions = {
  shouldExcludeStatement?: (context: QueryContext, query: Query) => boolean;
};

function extractParts(sqlStatement: string): {
  sql: string;
  name?: string;
} {
  const regex = /\/\*(.*?)\*\//;
  const match = sqlStatement.match(regex);
  const name = match ? match[1]?.trim() : undefined;
  const sql = sqlStatement.replace(regex, '').trim();

  return { sql, name };
}

export const createSlonikInterceptor = (options: SlonikTracingInterceptorOptions): Interceptor => {
  const tracer = trace.getTracer('slonik');
  const connections: Record<string, Record<string, Span>> = {};
  const shouldExcludeFn = options.shouldExcludeStatement || (() => false);

  return {
    afterPoolConnection(context) {
      connections[context.connectionId] = {};

      return null;
    },
    beforePoolConnectionRelease(context) {
      if (!connections[context.connectionId]) {
        return null;
      }

      delete connections[context.connectionId];

      return null;
    },
    async beforeQueryResult(context, query, result) {
      if (!connections[context.connectionId]) {
        return null;
      }

      const shouldExclude = shouldExcludeFn(context, query);

      if (shouldExclude) {
        return null;
      }

      const span = connections[context.connectionId][context.queryId];

      if (span) {
        span.setAttribute('db.result.command', result.command);
        span.setAttribute('db.result.count', result.rowCount);
        span.end();
      }

      return null;
    },

    async beforeQueryExecution(context, query) {
      if (!connections[context.connectionId]) {
        return null;
      }

      const shouldExclude = shouldExcludeFn(context, query);
      if (shouldExclude) {
        return null;
      }

      const statementsParts = extractParts(query.sql);
      const span = tracer.startSpan(statementsParts.name ? `PG: ${statementsParts.name}` : 'PG', {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.transaction.id': context.transactionId || '',
          'db.connection.id': context.connectionId,
          'db.statement': statementsParts.sql,
          'db.query.id': context.queryId,
        },
      });

      connections[context.connectionId][context.queryId] = span;

      return null;
    },
    queryExecutionError(context, query, error) {
      if (!connections[context.connectionId]) {
        return null;
      }

      const shouldExclude = shouldExcludeFn(context, query);

      if (shouldExclude) {
        return null;
      }

      const span = connections[context.connectionId][context.queryId];

      if (span) {
        span.setAttribute('error', 'true');
        span.setAttribute('error.type', error.name);
        span.setAttribute('error.message', error.message);
        span.end();
      }

      return null;
    },
  };
};

const tracer = trace.getTracer('hive');

export const traceInlineSync = <TArgs extends any[], TResult>(
  spanNameOrFn: string | ((...args: TArgs) => string),
  options: FunctionTraceOptions<TArgs, TResult>,
  fn: (...args: TArgs) => TResult,
) => {
  return (...args: TArgs): TResult => {
    const spanName = spanNameOrFn instanceof Function ? spanNameOrFn(...args) : spanNameOrFn;
    const span = tracer.startSpan(spanName, {
      attributes:
        options?.initAttributes instanceof Function
          ? options.initAttributes(...args)
          : options?.initAttributes,
      kind: SpanKind.INTERNAL,
    });

    return context.with(trace.setSpan(context.active(), span), () => {
      try {
        const result = fn(...args);
        span.setStatus({ code: SpanStatusCode.OK });

        if (options?.resultAttributes) {
          span.setAttributes(
            options.resultAttributes instanceof Function
              ? options.resultAttributes(result)
              : options.resultAttributes,
          );
        }

        return result;
      } catch (error) {
        if (error instanceof Error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          span.setAttributes({
            'error.type': error.name,
          });

          if (options?.errorAttributes) {
            span.setAttributes(
              options.errorAttributes instanceof Function
                ? options.errorAttributes(error)
                : options.errorAttributes,
            );
          }
        }

        throw error;
      } finally {
        span.end();
      }
    });
  };
};

export const traceInline = <TArgs extends any[], TResult>(
  spanName: string,
  options: FunctionTraceOptions<TArgs, Awaited<TResult>>,
  fn: (...args: TArgs) => TResult,
) => {
  return async (...args: TArgs): Promise<TResult> => {
    const span = tracer.startSpan(spanName, {
      attributes:
        options?.initAttributes instanceof Function
          ? options.initAttributes(...args)
          : options?.initAttributes,
      kind: SpanKind.INTERNAL,
    });

    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await fn(...args);
        span.setStatus({ code: SpanStatusCode.OK });

        if (options?.resultAttributes) {
          span.setAttributes(
            options.resultAttributes instanceof Function
              ? options.resultAttributes(result)
              : options.resultAttributes,
          );
        }

        return result;
      } catch (error) {
        if (error instanceof Error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          span.setAttributes({
            'error.type': error.name,
          });

          if (options?.errorAttributes) {
            span.setAttributes(
              options.errorAttributes instanceof Function
                ? options.errorAttributes(error)
                : options.errorAttributes,
            );
          }
        }

        throw error;
      } finally {
        span.end();
      }
    });
  };
};

type FunctionTraceOptions<TArgs extends any[], TResult> = {
  initAttributes?: Attributes | ((...args: TArgs) => Attributes);
  resultAttributes?: Attributes | ((result: TResult) => Attributes);
  errorAttributes?: Attributes | ((error: Error) => Attributes);
};

export function traceFn<This extends Object, TArgs extends any[], TResult>(
  spanName: string,
  options?: FunctionTraceOptions<TArgs, Awaited<TResult>>,
) {
  return function (
    target: This,
    key: PropertyKey,
    descriptor: TypedPropertyDescriptor<(...args: TArgs) => TResult>,
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = function wrappedWithTracing(this: This, ...args: TArgs) {
      const span = tracer.startSpan(spanName, {
        attributes:
          options?.initAttributes instanceof Function
            ? options.initAttributes(...args)
            : options?.initAttributes,
        kind: SpanKind.INTERNAL,
      });

      return context.with(trace.setSpan(context.active(), span), async () => {
        try {
          const result = await ((originalMethod as any).apply(this, args) as Promise<TResult>);
          span.setStatus({ code: SpanStatusCode.OK });

          if (options?.resultAttributes) {
            span.setAttributes(
              options.resultAttributes instanceof Function
                ? options.resultAttributes(result)
                : options.resultAttributes,
            );
          }

          return result;
        } catch (error) {
          if (error instanceof Error) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            span.setAttributes({
              'error.type': error.name,
            });

            if (options?.errorAttributes) {
              span.setAttributes(
                options.errorAttributes instanceof Function
                  ? options.errorAttributes(error)
                  : options.errorAttributes,
              );
            }
          }

          throw error;
        } finally {
          span.end();
        }
      });
    } as any;
  };
}
