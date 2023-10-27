import type { OptionsOfJSONResponseBody } from 'got';
import { got, HTTPError, TimeoutError } from 'got';
import { Injectable } from 'graphql-modules';
import * as Sentry from '@sentry/node';
import type { Span } from '@sentry/types';
import type { Logger } from './logger';

interface HttpClientOptions extends OptionsOfJSONResponseBody {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  context?: {
    description?: string;
    logger?: Logger;
  };
}

type HttpOptions = Omit<HttpClientOptions, 'method' | 'throwHttpErrors' | 'resolveBodyOnly'>;

@Injectable()
export class HttpClient {
  get<T>(url: string, opts: HttpOptions, span?: Span): Promise<T> {
    return this.request<T>(url, { ...opts, method: 'GET' }, span);
  }
  post<T>(url: string, opts: HttpOptions = {}, span?: Span): Promise<T> {
    return this.request<T>(url, { ...opts, method: 'POST' }, span);
  }
  put<T>(url: string, opts: HttpOptions = {}, span?: Span): Promise<T> {
    return this.request<T>(url, { ...opts, method: 'PUT' }, span);
  }
  delete<T>(url: string, opts: HttpOptions, span?: Span): Promise<T> {
    return this.request<T>(url, { ...opts, method: 'DELETE' }, span);
  }

  private request<T>(url: string, opts: HttpClientOptions, upstreamSpan?: Span) {
    const scope = Sentry.getCurrentHub().getScope();
    const parentSpan = upstreamSpan ?? scope?.getSpan();
    const span = parentSpan?.startChild({
      op: 'HttpClient',
      description: opts?.context?.description ?? `${opts.method} ${url}`,
    });

    const logger = opts?.context?.logger ?? console;

    const request = got<T>(url, {
      ...opts,
      throwHttpErrors: true,
    });

    if (!span) {
      return request.then(response => response.body);
    }

    return request
      .then(
        response => {
          span.setHttpStatus(response.statusCode);

          if (typeof response.headers['x-cache'] !== 'undefined') {
            span.setTag('cache', response.headers['x-cache'] as string);
          }
          return Promise.resolve(response.body);
        },
        error => {
          if (opts.context?.description) {
            span.setTag('contextDescription', opts.context.description);
            logger.debug('Request context description %s', opts.context.description);
          }

          let details: string | null = null;

          if (error instanceof HTTPError) {
            span.setHttpStatus(error.response.statusCode);

            if (typeof error.response.body === 'string') {
              details = error.response.body;
              logger.error(details);
            } else if (typeof error.response.body === 'object') {
              details = JSON.stringify(error.response.body);
              logger.error(details);
            }
          }
          span.setStatus(error instanceof TimeoutError ? 'deadline_exceeded' : 'internal_error');

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
        span.finish();
      });
  }
}
