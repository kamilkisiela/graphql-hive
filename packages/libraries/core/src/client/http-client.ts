import asyncRetry from 'async-retry';
import { Logger } from '@graphql-hive/logger';
import { abortSignalAny } from '@graphql-hive/signal';
import { crypto, fetch, URL } from '@whatwg-node/fetch';
import type { LegacyLogger } from './types';

export interface HttpCallConfig {
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
  logger?: LegacyLogger;
  /**
   * Function for determining whether the request response is okay.
   * You can override it if you want to accept other status codes as well.
   * @default {response => response.ok}
   **/
  isRequestOk?: ResponseAssertFunction;
  /** Optional abort signal */
  signal?: AbortSignal;
}

/**
 * Return a string that contains the reason on why the request should be retried.
 */
type ResponseAssertFunction = (response: Response) => boolean;

export type RetryOptions = Parameters<typeof asyncRetry>[1];

function get(endpoint: string, config: HttpCallConfig) {
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

function post(endpoint: string, data: string | Buffer, config: HttpCallConfig) {
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

function chooseLogger(logger: HttpCallConfig['logger']): Logger {
  if (!logger) {
    return new Logger({
      writers: [{ write() {} }],
    });
  }

  if (logger instanceof Logger) {
    return logger;
  }

  return new Logger({
    level: 'debug',
    writers: [
      {
        write(level, _attrs, msg) {
          if (level === 'debug' && logger.debug && msg) {
            logger.debug(msg);
            return;
          }
          if (level === 'info' && msg) {
            logger.info(msg);
            return;
          }
          if (level === 'error' && msg) {
            logger.error(msg);
          }
        },
      },
    ],
  });
}

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
    logger?: LegacyLogger;
    /**
     * Function for determining whether the request response is okay.
     * You can override it if you want to accept other status codes as well.
     * @default {response => response.ok}
     **/
    isRequestOk?: ResponseAssertFunction;
    /** Optional abort signal */
    signal?: AbortSignal;
  },
): Promise<Response> {
  const logger = chooseLogger(config.logger);
  const isRequestOk: ResponseAssertFunction = config.isRequestOk ?? (response => response.ok);
  let retries = 0;
  let minTimeout = 200;
  let maxTimeout = 2000;
  let factor = 1.2;

  const actionHeader =
    config.method === 'POST' ? { 'x-client-action-id': crypto.randomUUID() } : undefined;

  if (config.retry !== false) {
    retries = config.retry?.retries ?? 5;
    minTimeout = config.retry?.minTimeout ?? 200;
    maxTimeout = config.retry?.maxTimeout ?? 2000;
    factor = config.retry?.factor ?? 1.2;
  }

  return await asyncRetry(
    async (bail, attempt) => {
      const isFinalAttempt = attempt > retries;
      const requestId = crypto.randomUUID();

      logger.debug(
        `${config.method} ${endpoint} (x-request-id=${requestId})` +
          (retries > 0 ? ' ' + getAttemptMessagePart(attempt, retries + 1) : ''),
      );

      const getDuration = measureTime();
      const timeoutSignal = AbortSignal.timeout(config.timeout ?? 20_000);
      const signal = config.signal ? abortSignalAny([config.signal, timeoutSignal]) : timeoutSignal;

      let body: BodyInit | undefined | null;
      if (typeof config.body === 'string') {
        body = config.body;
      } else if (config.body) {
        body = new Uint8Array(config.body).buffer;
      }

      const response = await ((config.fetchImplementation ?? fetch) as typeof fetch)(endpoint, {
        method: config.method,
        body,
        headers: {
          'x-request-id': requestId,
          ...actionHeader,
          ...config.headers,
        },
        signal,
      }).catch((error: unknown) => {
        const msg =
          `${config.method} ${endpoint} (x-request-id=${requestId}) failed ${getDuration()}. ` +
          getErrorMessage(error);

        if (isFinalAttempt) {
          logger.error({ error }, msg);
        } else {
          logger.debug({ error }, msg);
        }

        throw new Error(`Unexpected HTTP error. (x-request-id=${requestId})`, { cause: error });
      });

      if (config.signal?.aborted === true) {
        const error = config.signal.reason ?? new Error('Request aborted externally.');
        bail(error);
        throw error;
      }

      if (isRequestOk(response)) {
        logger?.debug?.(
          `${config.method} ${endpoint} (x-request-id=${requestId}) succeeded with status ${response.status} ${getDuration()}.`,
        );

        return response;
      }

      if (isFinalAttempt) {
        logger.error(
          `${config.method} ${endpoint} (x-request-id=${requestId}) failed with status ${response.status} ${getDuration()}: ${(await response.text()) || '<empty response body>'}`,
        );
        logger.error(
          `${config.method} ${endpoint} (x-request-id=${requestId}) retry limit exceeded after ${attempt} attempts.`,
        );
      } else {
        logger.debug(
          `${config.method} ${endpoint} (x-request-id=${requestId}) failed with status ${response.status} ${getDuration()}: ${(await response.text()) || '<empty response body>'}`,
        );
      }

      const error = new HTTPResponseError(
        `${config.method} ${endpoint} (x-request-id=${requestId}) failed with status ${response.status}.`,
        response.status,
        response.statusText,
        response.headers.get('x-request-id') ?? undefined,
      );

      if (response.status >= 400 && response.status < 500) {
        if (retries > 0) {
          logger.error(`Abort retry because of status code ${response.status}.`);
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

/** Thrown when the final response has a status code that is not accepted by `isRequestOk`. */
export class HTTPResponseError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly statusText: string,
    /** The request id the server returned in its `x-request-id` response header, if any. */
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'HTTPResponseError';
  }
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

export { URL };
