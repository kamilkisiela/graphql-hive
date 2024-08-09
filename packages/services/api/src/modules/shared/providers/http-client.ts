import type { OptionsOfJSONResponseBody } from 'got';
import { got, HTTPError, TimeoutError } from 'got';
import { Injectable } from 'graphql-modules';
import { SpanKind, trace, type Span } from '@hive/service-common';
import * as Sentry from '@sentry/node';
import type { Logger } from './logger';

interface HttpClientOptions extends OptionsOfJSONResponseBody {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  context?: {
    logger?: Logger;
  };
}

type HttpOptions = Omit<HttpClientOptions, 'method' | 'throwHttpErrors' | 'resolveBodyOnly'>;

@Injectable()
export class HttpClient {
  private tracer: ReturnType<(typeof trace)['getTracer']>;

  constructor() {
    this.tracer = trace.getTracer('http-client');
  }

  get<T>(url: string, opts: HttpOptions, parentSpan?: Span): Promise<T> {
    return this.request<T>(url, { ...opts, method: 'GET' }, parentSpan);
  }
  post<T>(url: string, opts: HttpOptions = {}, parentSpan?: Span): Promise<T> {
    return this.request<T>(url, { ...opts, method: 'POST' }, parentSpan);
  }
  put<T>(url: string, opts: HttpOptions = {}, parentSpan?: Span): Promise<T> {
    return this.request<T>(url, { ...opts, method: 'PUT' }, parentSpan);
  }
  delete<T>(url: string, opts: HttpOptions, parentSpan?: Span): Promise<T> {
    return this.request<T>(url, { ...opts, method: 'DELETE' }, parentSpan);
  }

  private request<T>(url: string, opts: HttpClientOptions, parentSpan?: Span) {
    const logger = opts?.context?.logger ?? console;
    const parsedUrl = new URL(url);
    const span =
      parentSpan ??
      this.tracer.startSpan('HTTP (got)', {
        kind: SpanKind.CLIENT,
        attributes: {
          'http.client': 'got',
          'client.address': parsedUrl.hostname,
          'client.port': parsedUrl.port,
          'http.method': opts.method,
          'http.route': parsedUrl.pathname,
        },
      });

    const request = got<T>(url, {
      ...opts,
      throwHttpErrors: true,
    });

    return request
      .then(
        response => {
          span.setAttribute('http.response.body.size', response.rawBody.length);
          span.setAttribute('http.response.status_code', response.statusCode);

          if (typeof response.headers['x-cache'] !== 'undefined') {
            span.setAttribute('cache', response.headers['x-cache'] as string);
          }

          return Promise.resolve(response.body);
        },
        error => {
          let details: string | null = null;

          if (error instanceof HTTPError) {
            span.setAttribute('http.response.status_code', error.response.statusCode);
            if (typeof error.response.body === 'string') {
              details = error.response.body;
              logger.error(details);
            } else if (typeof error.response.body === 'object') {
              details = JSON.stringify(error.response.body);
              logger.error(details);
            }
          }

          span.setAttribute(
            'error.type',
            error instanceof TimeoutError ? 'deadline_exceeded' : 'internal_error',
          );
          span.setAttribute('error.message', details || '');

          logger.error(error);
          Sentry.captureException(error, {
            extra: {
              details,
            },
          });
          return Promise.reject(error);
        },
      )
      .finally(() => {
        span.end();
      });
  }
}
