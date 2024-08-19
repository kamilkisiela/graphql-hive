import asyncRetry from 'async-retry';
import { fetch, URL } from '@whatwg-node/fetch';
import type { Logger } from './types.js';

interface SharedConfig {
  headers: Record<string, string>;
  /**
   * timeout in milliseconds (for each single fetch call)
   * @default 20_000
   */
  timeout?: number;
  /** Retry configuration. Set to `false` for having no retries. */
  retry?: RetryOptions | false;
  /** custom fetch implementation. */
  fetchImplementation?: typeof fetch;
  /** Logger for HTTP info and request errors. Uses `console` by default. */
  logger?: Logger;
  /**
   * Function for determining whether the request response is okay.
   * You can override it if you want to accept other status codes as well.
   * @default {response => response.ok}
   **/
  isRequestOk?: ResponseAssertFunction;
}

/**
 * Return a string that contains the reason on why the request should be retried.
 */
type ResponseAssertFunction = (response: Response) => boolean;

type RetryOptions = Parameters<typeof asyncRetry>[1];

function get(endpoint: string, config: SharedConfig) {
  return makeFetchCall(endpoint, {
    method: 'GET',
    headers: config.headers,
    timeout: config.timeout,
    retry: config.retry,
    fetchImplementation: config.fetchImplementation,
    logger: config.logger,
    isRequestOk: config.isRequestOk,
  });
}

function post(endpoint: string, data: string | Buffer, config: SharedConfig) {
  return makeFetchCall(endpoint, {
    body: data,
    method: 'POST',
    ...config,
  });
}

export const http = {
  get,
  post,
};

export async function makeFetchCall(
  endpoint: URL | string,
  config: {
    body?: string | Buffer;
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    /**
     * timeout in milliseconds (for each single fetch call)
     * @default 20_000
     */
    timeout?: number;
    /** Retry configuration. Set to `false` for having no retries. */
    retry?: RetryOptions | false;
    /** custom fetch implementation. */
    fetchImplementation?: typeof fetch;
    /** Logger for HTTP info and request errors. Uses `console` by default. */
    logger?: Logger;
    /**
     * Function for determining whether the request response is okay.
     * You can override it if you want to accept other status codes as well.
     * @default {response => response.ok}
     **/
    isRequestOk?: ResponseAssertFunction;
  },
): Promise<Response> {
  const logger = config.logger;
  const isRequestOk: ResponseAssertFunction = config.isRequestOk ?? (response => response.ok);
  let retries = 0;
  let minTimeout = 200;
  let maxTimeout = 2000;
  let factor = 1.2;

  if (config.retry !== false) {
    retries = config.retry?.retries ?? 5;
    minTimeout = config.retry?.minTimeout ?? 200;
    maxTimeout = config.retry?.maxTimeout ?? 2000;
    factor = config.retry?.factor ?? 1.2;
  }

  return await asyncRetry(
    async (bail, attempt) => {
      logger?.info(
        `${config.method} ${endpoint}` +
          (retries > 0 ? ' ' + getAttemptMessagePart(attempt, retries + 1) : ''),
      );

      const getDuration = measureTime();
      const signal = AbortSignal.timeout(config.timeout ?? 20_000);

      const response = await (config.fetchImplementation ?? fetch)(endpoint, {
        method: config.method,
        body: config.body,
        headers: config.headers,
        signal,
      }).catch((error: unknown) => {
        const logErrorMessage = () =>
          logger?.error(
            `${config.method} ${endpoint} failed ${getDuration()}. ` + getErrorMessage(error),
          );

        if (isAggregateError(error)) {
          for (const err of error.errors) {
            logger?.error(err);
          }

          logErrorMessage();
          throw new Error('Unexpected HTTP error.', { cause: error });
        }

        logger?.error(error);
        logErrorMessage();
        throw new Error('Unexpected HTTP error.', { cause: error });
      });

      if (isRequestOk(response)) {
        logger?.info(
          `${config.method} ${endpoint} succeeded with status ${response.status} ${getDuration()}.`,
        );

        return response;
      }

      logger?.error(
        `${config.method} ${endpoint} failed with status ${response.status} ${getDuration()}: ${(await response.text()) || '<empty response body>'}`,
      );

      if (retries > 0 && attempt > retries) {
        logger?.error(
          `${config.method} ${endpoint} retry limit exceeded after ${attempt} attempts.`,
        );
      }

      const error = new Error(
        `${config.method} ${endpoint} failed with status ${response.status}.`,
      );

      if (response.status >= 400 && response.status < 500) {
        if (retries > 0) {
          logger?.error(`Abort retry because of status code ${response.status}.`);
        }
        bail(error);
      }

      throw error;
    },
    {
      retries,
      minTimeout,
      maxTimeout,
      factor,
    },
  );
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return '<no error message>';
}

function getAttemptMessagePart(attempt: number, retry: number): string {
  return `Attempt (${attempt}/${retry})`;
}

function measureTime() {
  const start = Date.now();
  return () => '(' + formatTimestamp(Date.now() - start) + ')';
}

function formatTimestamp(timestamp: number): string {
  const milliseconds = timestamp % 1000;
  const seconds = Math.floor((timestamp / 1000) % 60);
  const minutes = Math.floor((timestamp / (1000 * 60)) % 60);
  const hours = Math.floor(timestamp / (1000 * 60 * 60));

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || hours > 0) {
    // Include minutes if hours exist, even if minutes are 0
    parts.push(`${minutes}m`);
  }

  if (seconds > 0 || minutes > 0 || hours > 0) {
    parts.push(`${seconds}s`);
  }

  parts.push(`${milliseconds}ms`);

  return parts.join(':');
}

interface AggregateError extends Error {
  errors: Error[];
}

function isAggregateError(error: unknown): error is AggregateError {
  return !!error && typeof error === 'object' && 'errors' in error && Array.isArray(error.errors);
}

export { URL };
