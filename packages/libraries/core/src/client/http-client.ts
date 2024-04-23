import { fetch } from '@whatwg-node/fetch';

function get(
  endpoint: string,
  config: {
    headers: Record<string, string>;
    timeout?: number;
    fetchImplementation?: typeof fetch;
  },
) {
  return makeFetchCall(endpoint, {
    method: 'GET',
    headers: config.headers,
    timeout: config.timeout,
    fetchImplementation: config.fetchImplementation,
  });
}

function post(
  endpoint: string,
  data: string | Buffer,
  config: {
    headers: Record<string, string>;
    timeout?: number;
    fetchImplementation?: typeof fetch;
  },
) {
  return makeFetchCall(endpoint, {
    body: data,
    method: 'POST',
    headers: config.headers,
    timeout: config.timeout,
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
    fetchImplementation?: typeof fetch;
  },
) {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  const responsePromise = (config.fetchImplementation ?? fetch)(endpoint, {
    method: config.method,
    body: config.body,
    headers: config.headers,
    signal: controller.signal,
  });

  if (config.timeout) {
    timeoutId = setTimeout(() => controller.abort(), config.timeout);
  }

  try {
    return await responsePromise;
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
