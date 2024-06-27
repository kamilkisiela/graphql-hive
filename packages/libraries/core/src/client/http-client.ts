import asyncRetry from 'async-retry';
import { fetch, URL } from '@whatwg-node/fetch';

type RetryOptions = Parameters<typeof asyncRetry>[1] & {
  retryWhen(response: Response): boolean;
  okWhen?(response: Response): boolean;
};

function get(
  endpoint: string,
  config: {
    headers: Record<string, string>;
    timeout?: number;
    fetchImplementation?: typeof fetch;
    retry?: RetryOptions;
  },
) {
  return makeFetchCall(endpoint, {
    method: 'GET',
    headers: config.headers,
    timeout: config.timeout,
    retry: config.retry,
    fetchImplementation: config.fetchImplementation,
  });
}

function post(
  endpoint: string,
  data: string | Buffer,
  config: {
    headers: Record<string, string>;
    timeout?: number;
    retry?: RetryOptions;
    fetchImplementation?: typeof fetch;
  },
) {
  return makeFetchCall(endpoint, {
    body: data,
    method: 'POST',
    headers: config.headers,
    timeout: config.timeout,
    retry: config.retry,
    fetchImplementation: config.fetchImplementation,
  });
}

export const http = {
  get,
  post,
};

async function makeFetchCall(
  endpoint: string,
  config: {
    body?: string | Buffer;
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    timeout?: number;
    retry?: RetryOptions;
    fetchImplementation?: typeof fetch;
  },
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

  if (config.timeout) {
    timeoutId = setTimeout(() => controller.abort(), config.timeout);
  }

  try {
    const retryOptions = config.retry;
    if (!retryOptions) {
      return await (config.fetchImplementation ?? fetch)(endpoint, {
        method: config.method,
        body: config.body,
        headers: config.headers,
        signal: controller.signal,
      });
    }

    const result = await asyncRetry(
      async bail => {
        const res = await (config.fetchImplementation ?? fetch)(endpoint, {
          method: config.method,
          body: config.body,
          headers: config.headers,
          signal: controller.signal,
        });

        if (res.ok || retryOptions.okWhen?.(res)) {
          return res;
        }

        if (!retryOptions.retryWhen(res)) {
          bail(
            new Error(
              `Failed to fetch ${endpoint}, received: ${res.status} ${res.statusText ?? 'Internal Server Error'}`,
            ),
          );
          return;
        }

        throw new Error(
          `Failed to fetch ${endpoint}, received: ${res.status} ${res.statusText ?? 'Internal Server Error'}`,
        );
      },
      {
        ...retryOptions,
        retries: retryOptions?.retries ?? 5,
        minTimeout: retryOptions?.minTimeout ?? 200,
        maxTimeout: retryOptions?.maxTimeout ?? 2000,
        factor: retryOptions?.factor ?? 1.2,
      },
    );

    if (result === undefined) {
      throw new Error('Failed to bail out of retry.');
    }

    return result;
  } catch (error) {
    if (isAggregateError(error)) {
      throw new Error(error.errors.map(e => e.message).join(', '), {
        cause: error,
      });
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

interface AggregateError extends Error {
  errors: Error[];
}

function isAggregateError(error: unknown): error is AggregateError {
  return !!error && typeof error === 'object' && 'errors' in error && Array.isArray(error.errors);
}

export { URL };
