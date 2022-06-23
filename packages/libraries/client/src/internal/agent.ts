import retry from 'async-retry';
import axios from 'axios';
import { version } from '../version';
import type { Logger } from './types';

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
   * Send report after each GraphQL operation
   */
  sendImmediately?: boolean;
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
}

export function createAgent<T>(
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
      set(data: T): void;
      size(): number;
    };
    body(): Buffer | string | Promise<string | Buffer>;
    headers?(): Record<string, string>;
  }
) {
  const options: Required<AgentOptions> = {
    timeout: 30_000,
    debug: false,
    enabled: true,
    minTimeout: 200,
    maxRetries: 3,
    sendImmediately: false,
    sendInterval: 10_000,
    maxSize: 25,
    logger: console,
    name: 'Hive',
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

  if (!options.sendImmediately) {
    schedule();
  }

  function debugLog(msg: string) {
    if (options.debug) {
      options.logger.info(`[hive][${prefix}]${enabled ? '' : '[DISABLED]'} ${msg}`);
    }
  }

  function capture(event: T) {
    data.set(event);

    if (options.sendImmediately || data.size() >= options.maxSize) {
      debugLog('Sending immediately');
      setImmediate(() => send({ runOnce: true }));
    }
  }

  async function send(sendOptions?: { runOnce?: boolean }): Promise<void> {
    const runOnce = sendOptions?.runOnce ?? false;

    if (!data.size()) {
      if (!runOnce) {
        schedule();
      }
      return;
    }

    try {
      const buffer = await body();
      const dataToSend = data.size();

      data.clear();

      const sendReport: retry.RetryFunction<any> = async (_bail, attempt) => {
        debugLog(`Sending (queue ${dataToSend}) (attempt ${attempt})`);

        if (!enabled) {
          return {
            statusCode: 200,
          };
        }

        const response = await axios
          .post(options.endpoint, buffer, {
            headers: {
              'content-type': 'application/json',
              'x-api-token': options.token,
              'User-Agent': `${options.name}@${version}`,
              ...headers(),
            },
            responseType: 'json',
            timeout: options.timeout,
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

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`[hive][${prefix}] Failed to send data (HTTP status ${response.status}): ${response.data}`);
      }

      debugLog(`Sent!`);
    } catch (error: any) {
      options.logger.error(`[hive][${prefix}] Failed to send data: ${error.message}`);
    }

    if (!runOnce) {
      schedule();
    }
  }

  async function dispose() {
    debugLog('Disposing');
    if (timeoutID) {
      clearTimeout(timeoutID);
    }

    await send({
      runOnce: true,
    });
  }

  return {
    capture,
    dispose,
  };
}
