import { FastifyPluginCallback } from 'fastify';
import {
  FetchInstrumentation,
  type FetchInstrumentationConfig,
} from 'opentelemetry-instrumentation-fetch-node';
import type { Interceptor } from 'slonik';
import zod from 'zod';
import * as fastifyOpenTelemetry from '@autotelic/fastify-opentelemetry';
import {
  Attributes,
  context,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  SpanKind,
  SpanStatusCode,
  trace,
  type Span,
} from '@opentelemetry/api';
import {
  getNodeAutoInstrumentations,
  InstrumentationConfigMap,
} from '@opentelemetry/auto-instrumentations-node';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK, NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

export { trace, Span, SpanKind };

type Instrumentations = NodeSDKConfiguration['instrumentations'];

export class TracingInstance {
  private nodeInstrumentations: InstrumentationConfigMap = {
    '@opentelemetry/instrumentation-http': { enabled: true },
    // Disabled by default
    '@opentelemetry/instrumentation-amqplib': { enabled: false },
    '@opentelemetry/instrumentation-aws-lambda': { enabled: false },
    '@opentelemetry/instrumentation-aws-sdk': { enabled: false },
    '@opentelemetry/instrumentation-bunyan': { enabled: false },
    '@opentelemetry/instrumentation-cassandra-driver': { enabled: false },
    '@opentelemetry/instrumentation-connect': { enabled: false },
    '@opentelemetry/instrumentation-cucumber': { enabled: false },
    '@opentelemetry/instrumentation-dataloader': { enabled: false },
    '@opentelemetry/instrumentation-dns': { enabled: false },
    '@opentelemetry/instrumentation-express': { enabled: false },
    '@opentelemetry/instrumentation-fastify': { enabled: false },
    '@opentelemetry/instrumentation-fs': { enabled: false },
    '@opentelemetry/instrumentation-generic-pool': { enabled: false },
    '@opentelemetry/instrumentation-graphql': { enabled: false },
    '@opentelemetry/instrumentation-grpc': { enabled: false },
    '@opentelemetry/instrumentation-hapi': { enabled: false },
    '@opentelemetry/instrumentation-ioredis': { enabled: false },
    '@opentelemetry/instrumentation-knex': { enabled: false },
    '@opentelemetry/instrumentation-koa': { enabled: false },
    '@opentelemetry/instrumentation-lru-memoizer': { enabled: false },
    '@opentelemetry/instrumentation-memcached': { enabled: false },
    '@opentelemetry/instrumentation-mongodb': { enabled: false },
    '@opentelemetry/instrumentation-mongoose': { enabled: false },
    '@opentelemetry/instrumentation-mysql2': { enabled: false },
    '@opentelemetry/instrumentation-mysql': { enabled: false },
    '@opentelemetry/instrumentation-nestjs-core': { enabled: false },
    '@opentelemetry/instrumentation-net': { enabled: false },
    '@opentelemetry/instrumentation-pg': { enabled: false },
    '@opentelemetry/instrumentation-pino': { enabled: false },
    '@opentelemetry/instrumentation-redis': { enabled: false },
    '@opentelemetry/instrumentation-redis-4': { enabled: false },
    '@opentelemetry/instrumentation-restify': { enabled: false },
    '@opentelemetry/instrumentation-router': { enabled: false },
    '@opentelemetry/instrumentation-socket.io': { enabled: false },
    '@opentelemetry/instrumentation-tedious': { enabled: false },
    '@opentelemetry/instrumentation-winston': { enabled: false },
  };
  private additionalInstrumentations: Instrumentations = [];
  private sdk: NodeSDK | undefined;

  constructor(private options: { collectorEndpoint: string; serviceName: string }) {
    console.info('🛣️ OpenTelemetry tracing enabled');
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
  }

  build(): TracingInstance {
    const exporter = new OTLPTraceExporter({ url: this.options.collectorEndpoint });
    const instrumentations = [
      getNodeAutoInstrumentations(this.nodeInstrumentations),
      ...this.additionalInstrumentations,
    ];

    const processor = new BatchSpanProcessor(exporter);
    const contextManager = new AsyncHooksContextManager();

    const sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: this.options.serviceName,
      }),
      contextManager,
      traceExporter: exporter,
      spanProcessors: [processor],
      instrumentations,
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

  instrumentSlonik(): Interceptor {
    return createSlonikInterceptor();
  }

  instrumentNodeFetch(config: FetchInstrumentationConfig = {}) {
    const instance = new FetchInstrumentation({
      onRequest({ request, span }) {
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
    this.additionalInstrumentations.push(instance);
  }

  instrumentFastify(
    config?: fastifyOpenTelemetry.OpenTelemetryPluginOptions,
  ): [
    FastifyPluginCallback<fastifyOpenTelemetry.OpenTelemetryPluginOptions>,
    fastifyOpenTelemetry.OpenTelemetryPluginOptions,
  ] {
    return [
      fastifyOpenTelemetry.default,
      {
        wrapRoutes: true,
        exposeApi: true,
        ignoreRoutes: (path, method) => {
          return (
            ['/_health', '/_readiness', '/api/health', '/health'].includes(path) ||
            method === 'OPTIONS'
          );
        },
        formatSpanName: request => `${request.method} ${request.url.split('?')[0]}`,
        formatSpanAttributes: {
          request: request => {
            console.log(request.headers);
            return {
              request_id: request.headers['x-request-id'] || request.id,
              'http.request.method': request.method,
              'http.request.body.size': request.headers['content-length'],
              'http.route': request.url,
              'graphql.client.name':
                request.headers['graphql-client-name'] ||
                request.headers['x-graphql-client-name'] ||
                '',
              'http.user_agent': request.headers['user-agent'],
            };
          },
          reply: reply => ({
            'http.response.status_code': reply.statusCode,
            'http.response.body.size': reply.getHeader('content-length'),
          }),
          error: error => ({
            'error.type': error.name,
            'error.message': error.message,
            'error.stack': error.stack,
          }),
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
});

export const createSlonikInterceptor = (): Interceptor => {
  const tracer = trace.getTracer('slonik');
  const connections: Record<string, Record<string, Span>> = {};

  return {
    afterPoolConnection(context) {
      connections[context.connectionId] = {};

      return null;
    },
    async beforeQueryResult(context, query, result) {
      if (!connections[context.connectionId]) {
        return null;
      }

      const span = connections[context.connectionId][context.queryId];

      if (span) {
        span.setAttribute('db.result.command', result.command);
        span.setAttribute('db.result.count', result.rowCount);
        span.updateName(`Postgres: ${result.command}`);
        span.end();
      }

      return null;
    },
    beforePoolConnectionRelease(context) {
      if (!connections[context.connectionId]) {
        return null;
      }

      delete connections[context.connectionId];

      return null;
    },
    async beforeQueryExecution(context) {
      if (!connections[context.connectionId]) {
        return null;
      }

      const span = tracer.startSpan('Postgres', {
        kind: SpanKind.CLIENT,
        attributes: {
          'db.instance.id': context.connectionId,
          'db.statement': context.originalQuery.sql,
          'db.query.id': context.queryId,
        },
      });

      connections[context.connectionId][context.queryId] = span;

      return null;
    },
    queryExecutionError(context, _, error) {
      if (!connections[context.connectionId]) {
        return null;
      }

      const span = connections[context.connectionId][context.queryId];

      if (span) {
        span.setAttribute('error', 'true');
        span.setAttribute('error.type', error.name);
        span.setAttribute('error.message', error.message);
        span.setAttribute('error.stack', context.stackTrace?.join('\n') || '');
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
