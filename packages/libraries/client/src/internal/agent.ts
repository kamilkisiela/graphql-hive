import retry from 'async-retry';
import axios from 'axios';
import { version } from '../version.js';
import type { Logger } from './types.js';

export interface AgentOptions {
  enabled?: boolean;
  name?: string;
  /**
   * Hive endpoint or proxy
   */
  endpoint: string;
  /**
   * API Token
   */
  token: string;
  /**
   * 30s by default
   */
  timeout?: number;
  /**
   * false by default
   */
  debug?: boolean;
  /**
   * 5 by default
   */
  maxRetries?: number;
  /**
   * 200 by default
   */
  minTimeout?: number;
  /**
   * Send reports in interval (defaults to 10_000ms)
   */
  sendInterval?: number;
  /**
   * Max number of traces to send at once (defaults to 25)
   */
  maxSize?: number;
  /**
   * Custom logger (defaults to console)
   */
  logger?: Logger;
  /**
   * Define a custom http agent to be used when performing http requests
   */
  httpAgent?: any;
  /**
   * Define a custom https agent to be used when performing https requests
   */
  httpsAgent?: any;
}

export function createAgent<TEvent, TResult = void>(
  pluginOptions: AgentOptions,
  {
    prefix,
    data,
    body,
    headers = () => ({}),
  }: {
    prefix: string;
    data: {
      clear(): void;
      set(data: TEvent): void;
      size(): number;
    };
    body(): Buffer | string | Promise<string | Buffer>;
    headers?(): Record<string, string>;
  },
) {
  const options: Required<AgentOptions> = {
    timeout: 30_000,
    debug: false,
    enabled: true,
    minTimeout: 200,
    maxRetries: 3,
    sendInterval: 10_000,
    maxSize: 25,
    logger: console,
    name: 'hive-client',
    httpAgent: undefined,
    httpsAgent: undefined,
    ...pluginOptions,
  };

  const enabled = options.enabled !== false;

  let timeoutID: any = null;

  function schedule() {
    if (timeoutID) {
      clearTimeout(timeoutID);
    }

    timeoutID = setTimeout(send, options.sendInterval);
  }

  function debugLog(msg: string) {
    if (options.debug) {
      options.logger.info(`[hive][${prefix}]${enabled ? '' : '[DISABLED]'} ${msg}`);
    }
  }

  let scheduled = false;

  function capture(event: TEvent) {
    // Calling capture starts the schedule
    if (!scheduled) {
      scheduled = true;
      schedule();
    }

    data.set(event);

    if (data.size() >= options.maxSize) {
      debugLog('Sending immediately');
      setImmediate(() => send({ runOnce: true, throwOnError: false }));
    }
  }

  function sendImmediately(event: TEvent): Promise<TResult | null> {
    data.set(event);

    debugLog('Sending immediately');
    return send({ runOnce: true, throwOnError: true });
  }

  async function send<T>(sendOptions: {
    runOnce?: boolean;
    throwOnError: true;
  }): Promise<T | null | never>;
  async function send<T>(sendOptions: {
    runOnce?: boolean;
    throwOnError: false;
  }): Promise<T | null>;
  async function send<T>(sendOptions?: {
    runOnce?: boolean;
    throwOnError: boolean;
  }): Promise<T | null | never> {
    const runOnce = sendOptions?.runOnce ?? false;

    if (!data.size()) {
      if (!runOnce) {
        schedule();
      }
      return null;
    }

    try {
      const buffer = await body();
      const dataToSend = data.size();

      data.clear();

      const sendReport: retry.RetryFunction<{
        status: number;
        data: T | null;
      }> = async (_bail, attempt) => {
        debugLog(`Sending (queue ${dataToSend}) (attempt ${attempt})`);

        if (!enabled) {
          return {
            status: 200,
            data: null,
          };
        }

        const response = await axios
          .post(options.endpoint, buffer, {
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
              Authorization: `Bearer ${options.token}`,
              'User-Agent': `${options.name}/${version}`,
              ...headers(),
            },
            responseType: 'json',
            timeout: options.timeout,
            httpAgent: options.httpAgent,
            httpsAgent: options.httpsAgent,
          })
          .catch(error => {
            debugLog(`Attempt ${attempt} failed: ${error.message}`);
            return Promise.reject(error);
          });

        if (response.status >= 200 && response.status < 300) {
          return response;
        }

        debugLog(`Attempt ${attempt} failed: ${response.status}`);
        throw new Error(`${response.status}: ${response.statusText}`);
      };

      const response = await retry(sendReport, {
        retries: options.maxRetries,
        minTimeout: options.minTimeout,
        factor: 2,
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(
          `[hive][${prefix}] Failed to send data (HTTP status ${response.status}): ${response.data}`,
        );
      }

      debugLog(`Sent!`);

      if (!runOnce) {
        schedule();
      }

      return response.data;
    } catch (error: any) {
      if (!runOnce) {
        schedule();
      }

      if (sendOptions?.throwOnError) {
        throw error;
      }

      options.logger.error(`[hive][${prefix}] Failed to send data: ${error.message}`);

      return null;
    }
  }

  async function dispose() {
    debugLog('Disposing');
    if (timeoutID) {
      clearTimeout(timeoutID);
    }

    await send({
      runOnce: true,
      throwOnError: false,
    });
  }

  return {
    capture,
    sendImmediately,
    dispose,
  };
}
