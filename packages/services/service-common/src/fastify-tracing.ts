// Adapted from: https://github.com/autotelic/fastify-opentelemetry

import {
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
  HookHandlerDoneFunction,
} from 'fastify';
import fp from 'fastify-plugin';
import {
  Attributes,
  context,
  Context,
  defaultTextMapGetter,
  defaultTextMapSetter,
  propagation,
  Span,
  SpanStatusCode,
  TextMapGetter,
  TextMapSetter,
  trace,
  Tracer,
} from '@opentelemetry/api';

type ReqInstance = {
  activeSpan: Span | undefined;
  context: Context;
  tracer: Tracer;
  inject: <Carrier>(carrier: Carrier, setter?: TextMapSetter) => void;
  extract: <Carrier>(carrier: Carrier, getter?: TextMapGetter) => Context;
};

export type OpenTelemetryReqInstance = ReqInstance;

export type OpenTelemetryPluginOptions = {
  exposeApi?: boolean;
  formatSpanName?: (request: FastifyRequest) => string;
  formatSpanAttributes?: {
    request?: (request: FastifyRequest) => Attributes;
    reply?: (reply: FastifyReply) => Attributes;
    error?: (error: Error) => Attributes;
  };
  wrapRoutes?: boolean | string[];
  ignoreRoutes?: string[] | IgnoreRouteFn;
};

export type IgnoreRouteFn = (path: string, method: string) => boolean;

declare module 'fastify' {
  interface FastifyRequest {
    openTelemetry: () => ReqInstance;
  }
}

function defaultFormatSpanName(request: FastifyRequest) {
  const { method } = request;
  let path;
  if (request.routeOptions) {
    path = request.routeOptions.url;
  } else {
    path = request.routerPath;
  }
  return path ? `${method} ${path}` : method;
}

const defaultFormatSpanAttributes = {
  request(request: FastifyRequest) {
    return {
      'req.method': request.raw.method,
      'req.url': request.raw.url,
    };
  },
  reply(reply: FastifyReply) {
    return {
      'reply.statusCode': reply.statusCode,
    };
  },
  error(error: Error) {
    return {
      'error.name': error.name,
      'error.message': error.message,
      'error.stack': error.stack,
    };
  },
};

const openTelemetryPlugin: FastifyPluginCallback<OpenTelemetryPluginOptions> = async (
  fastify,
  opts = {},
) => {
  const {
    wrapRoutes,
    exposeApi = true,
    formatSpanName = defaultFormatSpanName,
    ignoreRoutes = [],
  } = opts;

  const shouldIgnoreRoute: IgnoreRouteFn =
    typeof ignoreRoutes === 'function' ? ignoreRoutes : path => ignoreRoutes.includes(path);

  const formatSpanAttributes = {
    ...defaultFormatSpanAttributes,
    ...opts.formatSpanAttributes,
  };

  function getContext(request: FastifyRequest) {
    return contextMap.get(request) || context.active();
  }

  if (exposeApi) {
    fastify.decorateRequest('openTelemetry', function openTelemetry() {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const request: FastifyRequest = this;

      return {
        get activeSpan(): Span | undefined {
          return trace.getSpan(getContext(request));
        },
        get context(): any {
          return getContext(request);
        },
        get tracer() {
          return tracer;
        },
        inject(carrier, setter = defaultTextMapSetter) {
          return propagation.inject(getContext(request), carrier, setter);
        },
        extract(carrier, getter = defaultTextMapGetter) {
          return propagation.extract(getContext(request), carrier, getter);
        },
      };
    });
  }

  const contextMap = new WeakMap();
  const tracer = trace.getTracer('fastify-tracing');

  async function onRequest(request: FastifyRequest, _reply: FastifyReply) {
    if (shouldIgnoreRoute(request.url, request.method)) return;

    let activeContext = context.active();

    // if not running within a local span then extract the context from the headers carrier
    if (!trace.getSpan(activeContext)) {
      activeContext = propagation.extract(activeContext, request.headers);
    }

    const requestAttributes = formatSpanAttributes.request(request);
    const span = tracer.startSpan(
      formatSpanName(request),
      {
        attributes: requestAttributes,
      },
      activeContext,
    );

    contextMap.set(request, trace.setSpan(activeContext, span));
  }

  function onRequestWrapRoutes(
    request: FastifyRequest,
    reply: FastifyReply,
    done: HookHandlerDoneFunction,
  ) {
    if (
      !shouldIgnoreRoute(request.url, request.method) &&
      (wrapRoutes === true || (Array.isArray(wrapRoutes) && wrapRoutes.includes(request.url)))
    ) {
      context.with(getContext(request), done);
    } else {
      done();
    }
  }

  async function onResponse(request: FastifyRequest, reply: FastifyReply) {
    if (shouldIgnoreRoute(request.url, request.method)) return;

    const activeContext = getContext(request);
    const span = trace.getSpan(activeContext);

    if (!span) {
      return;
    }

    const spanStatus = { code: SpanStatusCode.OK };

    if (reply.statusCode >= 400) {
      spanStatus.code = SpanStatusCode.ERROR;
    }

    span.setAttributes(formatSpanAttributes.reply(reply));
    span.setStatus(spanStatus);
    span.end();
    contextMap.delete(request);
  }

  async function onError(request: FastifyRequest, reply: FastifyReply, error: Error) {
    if (shouldIgnoreRoute(request.url, request.method)) return;

    const activeContext = getContext(request);
    const span = trace.getSpan(activeContext);

    if (span) {
      span.setAttributes(formatSpanAttributes.error(error));
    }
  }

  fastify.addHook('onRequest', onRequest);
  if (wrapRoutes) fastify.addHook('onRequest', onRequestWrapRoutes);
  fastify.addHook('onResponse', onResponse);
  fastify.addHook('onError', onError);
};

export default fp(openTelemetryPlugin);
