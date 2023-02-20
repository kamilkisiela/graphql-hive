import type { OptionsOfJSONResponseBody } from 'got';
import { got, HTTPError, TimeoutError } from 'got';
import { Injectable } from 'graphql-modules';
import * as Sentry from '@sentry/node';
import type { Span } from '@sentry/types';

interface HttpClientOptions extends OptionsOfJSONResponseBody {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  context?: {
    description?: string;
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
    const parentSpan = upstreamSpan ?? Sentry.getCurrentHub().getScope()?.getSpan();
    const span = parentSpan?.startChild({
      op: 'HttpClient',
      description: opts?.context?.description ?? `${opts.method} ${url}`,
    });

    const request = got<T>(url, {
      ...opts,
      throwHttpErrors: true,
    });

    if (!span) {
      return request.then(response => response.body);
    }

    return request.then(
      response => {
        span.setHttpStatus(response.statusCode);

        if (typeof response.headers['x-cache'] !== 'undefined') {
          span.setTag('cache', response.headers['x-cache'] as string);
        }

        span.finish();
        return Promise.resolve(response.body);
      },
      error => {
        console.error(error);
        Sentry.captureException(error);

        if (error instanceof HTTPError) {
          span.setHttpStatus(error.response.statusCode);
        }

        span.setStatus(error instanceof TimeoutError ? 'deadline_exceeded' : 'internal_error');
        span.finish();
        return Promise.reject(error);
      },
    );
  }
}
