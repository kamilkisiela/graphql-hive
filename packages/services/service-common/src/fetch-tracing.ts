// Adapted from: https://github.com/gas-buddy/opentelemetry-instrumentation-fetch-node
/*
 * Portions from https://github.com/elastic/apm-agent-nodejs
 * Copyright Elasticsearch B.V. and other contributors where applicable.
 * Licensed under the BSD 2-Clause License; you may not use this file except in
 * compliance with the BSD 2-Clause License.
 *
 */
import diagch from 'node:diagnostics_channel';
import {
  Attributes,
  context,
  Meter,
  MeterProvider,
  metrics,
  propagation,
  Span,
  SpanKind,
  SpanStatusCode,
  trace,
  Tracer,
  TracerProvider,
} from '@opentelemetry/api';
import { Instrumentation, InstrumentationConfig } from '@opentelemetry/instrumentation';
import {
  SemanticAttributes,
  SEMATTRS_HTTP_METHOD,
  SEMATTRS_HTTP_ROUTE,
  SEMATTRS_HTTP_URL,
} from '@opentelemetry/semantic-conventions';

interface ListenerRecord {
  name: string;
  channel: diagch.Channel;
  onMessage: diagch.ChannelListener;
}

interface FetchRequest {
  method: string;
  origin: string;
  path: string;
  headers: string;
}

interface FetchResponse {
  headers: Buffer[];
  statusCode: number;
}

export interface FetchInstrumentationConfig extends InstrumentationConfig {
  ignoreRequestHook?: (request: FetchRequest) => boolean;
  staticAttributes?: Attributes;
  onRequest?: (args: {
    request: FetchRequest;
    span: Span;
    additionalHeaders: Record<string, string | string[]>;
  }) => void;
}

function getMessage(error: Error) {
  if (error instanceof AggregateError) {
    return error.errors.map(e => e.message).join(', ');
  }
  return error.message;
}

// Get the content-length from undici response headers.
// `headers` is an Array of buffers: [k, v, k, v, ...].
// If the header is not present, or has an invalid value, this returns null.
function contentLengthFromResponseHeaders(headers: Buffer[]) {
  const name = 'content-length';
  for (let i = 0; i < headers.length; i += 2) {
    const k = headers[i];
    if (k.length === name.length && k.toString().toLowerCase() === name) {
      const v = Number(headers[i + 1]);
      if (!Number.isNaN(Number(v))) {
        return v;
      }
      return undefined;
    }
  }
  return undefined;
}

// A combination of https://github.com/elastic/apm-agent-nodejs and
// https://github.com/gadget-inc/opentelemetry-instrumentations/blob/main/packages/opentelemetry-instrumentation-undici/src/index.ts
export class FetchInstrumentation implements Instrumentation {
  // Keep ref to avoid https://github.com/nodejs/node/issues/42170 bug and for
  // unsubscribing.
  private channelSubs: Array<ListenerRecord> | undefined;

  private spanFromReq = new WeakMap<FetchRequest, Span>();

  private tracer: Tracer;

  private config: FetchInstrumentationConfig;

  private meter: Meter;

  public readonly instrumentationName = 'opentelemetry-instrumentation-node-18-fetch';

  public readonly instrumentationVersion = '1.0.0';

  public readonly instrumentationDescription =
    'Instrumentation for Node 18 fetch via diagnostics_channel';

  private subscribeToChannel(diagnosticChannel: string, onMessage: diagch.ChannelListener) {
    const channel = diagch.channel(diagnosticChannel);
    channel.subscribe(onMessage);
    this.channelSubs!.push({
      name: diagnosticChannel,
      channel,
      onMessage,
    });
  }

  constructor(config: FetchInstrumentationConfig) {
    // Force load fetch API (since it's lazy loaded in Node 18)
    fetch('').catch(() => {});
    this.channelSubs = [];
    this.meter = metrics.getMeter(this.instrumentationName, this.instrumentationVersion);
    this.tracer = trace.getTracer(this.instrumentationName, this.instrumentationVersion);
    this.config = { ...config };
  }

  disable(): void {
    this.channelSubs?.forEach(sub => sub.channel.unsubscribe(sub.onMessage));
  }

  enable(): void {
    this.subscribeToChannel('undici:request:create', args =>
      this.onRequest(args as { request: FetchRequest }),
    );
    this.subscribeToChannel('undici:request:headers', args =>
      this.onHeaders(args as { request: FetchRequest; response: FetchResponse }),
    );
    this.subscribeToChannel('undici:request:trailers', args =>
      this.onDone(args as { request: FetchRequest }),
    );
    this.subscribeToChannel('undici:request:error', args =>
      this.onError(args as { request: FetchRequest; error: Error }),
    );
  }

  setTracerProvider(tracerProvider: TracerProvider): void {
    this.tracer = tracerProvider.getTracer(this.instrumentationName, this.instrumentationVersion);
  }

  public setMeterProvider(meterProvider: MeterProvider): void {
    this.meter = meterProvider.getMeter(this.instrumentationName, this.instrumentationVersion);
  }

  setConfig(config: InstrumentationConfig): void {
    this.config = { ...config };
  }

  getConfig(): InstrumentationConfig {
    return this.config;
  }

  onRequest({ request }: { request: FetchRequest }): void {
    // Don't instrument CONNECT - see comments at:
    // https://github.com/elastic/apm-agent-nodejs/blob/c55b1d8c32b2574362fc24d81b8e173ce2f75257/lib/instrumentation/modules/undici.js#L24
    if (request.method === 'CONNECT') {
      return;
    }
    if (this.config.ignoreRequestHook && this.config.ignoreRequestHook(request) === true) {
      return;
    }

    let spanName = `HTTP ${request.method}`;
    const attributes: Attributes = {
      [SEMATTRS_HTTP_URL]: getAbsoluteUrl(request.origin, request.path),
      [SEMATTRS_HTTP_METHOD]: request.method,
      [SEMATTRS_HTTP_ROUTE]: request.path,
      'http.client': 'fetch',
      ...this.config.staticAttributes,
    };

    if (request.path.startsWith('/trpc/')) {
      const url = new URL(request.origin + request.path);
      const trpcFunctionName = url.pathname.split('/').pop();
      spanName = `tRPC: ${trpcFunctionName}`;
      attributes['trpc.function'] = trpcFunctionName || '';
      attributes['trpc.server'] = url.host;
      attributes['trpc.input'] = url.search;
    }

    const span = this.tracer.startSpan(spanName, {
      kind: SpanKind.CLIENT,
      attributes,
    });
    const requestContext = trace.setSpan(context.active(), span);
    const addedHeaders: Record<string, string> = {};
    propagation.inject(requestContext, addedHeaders);

    if (this.config.onRequest) {
      this.config.onRequest({ request, span, additionalHeaders: addedHeaders });
    }

    if (Array.isArray(request.headers)) {
      request.headers.push(...Object.entries(addedHeaders).flat());
    } else {
      request.headers += Object.entries(addedHeaders)
        .map(([k, v]) => `${k}: ${v}\r\n`)
        .join('');
    }

    this.spanFromReq.set(request, span);
  }

  onHeaders({ request, response }: { request: FetchRequest; response: FetchResponse }): void {
    const span = this.spanFromReq.get(request);

    if (span !== undefined) {
      // We are currently *not* capturing response headers, even though the
      // intake API does allow it, because none of the other `setHttpContext`
      // uses currently do.

      const cLen = contentLengthFromResponseHeaders(response.headers);
      const attrs: Attributes = {
        [SemanticAttributes.HTTP_STATUS_CODE]: response.statusCode,
      };
      if (cLen) {
        attrs[SemanticAttributes.HTTP_RESPONSE_CONTENT_LENGTH] = cLen;
      }
      span.setAttributes(attrs);
      span.setStatus({
        code: response.statusCode >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
        message: String(response.statusCode),
      });
    }
  }

  onDone({ request }: { request: FetchRequest }): void {
    const span = this.spanFromReq.get(request);
    if (span !== undefined) {
      span.end();
      this.spanFromReq.delete(request);
    }
  }

  onError({ request, error }: { request: FetchRequest; error: Error }): void {
    const span = this.spanFromReq.get(request);
    if (span !== undefined) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: getMessage(error),
      });
      span.end();
    }
  }
}

function getAbsoluteUrl(origin: string, path: string = '/'): string {
  const url = String(origin);

  if (origin.endsWith('/') && path.startsWith('/')) {
    return `${url}${path.slice(1)}`;
  }

  if (!origin.endsWith('/') && !path.startsWith('/')) {
    return `${url}/${path.slice(1)}`;
  }

  return `${url}${path}`;
}
