import retry from 'async-retry';
import { version } from '../version.js';
import { http } from './http-client.js';
import type { Logger } from './types.js';

type ReadOnlyResponse = Pick<Response, 'status' | 'text' | 'json'>;

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
   * Testing purposes only
   */
  __testing?: {
    fetch?: typeof fetch;
  };
}

export function createAgent<TEvent>(
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
  const options: Required<Omit<AgentOptions, '__testing'>> = {
    timeout: 30_000,
    debug: false,
    enabled: true,
    minTimeout: 200,
    maxRetries: 3,
    sendInterval: 10_000,
    maxSize: 25,
    logger: console,
    name: 'hive-client',
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
  let inProgressCaptures: Promise<void>[] = [];

  function capture(event: TEvent | Promise<TEvent>) {
    if (event instanceof Promise) {
      const promise = captureAsync(event);
      inProgressCaptures.push(promise);
      void promise.finally(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        inProgressCaptures = inProgressCaptures.filter(p => p !== promise);
      });
    } else {
      captureSync(event);
    }
  }

  async function captureAsync(event: Promise<TEvent>) {
    captureSync(await event);
  }

  function captureSync(event: TEvent) {
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

  function sendImmediately(event: TEvent): Promise<ReadOnlyResponse | null> {
    data.set(event);

    debugLog('Sending immediately');
    return send({ runOnce: true, throwOnError: true });
  }

  async function send(sendOptions: {
    runOnce?: boolean;
    throwOnError: true;
  }): Promise<ReadOnlyResponse | null>;
  async function send(sendOptions: {
    runOnce?: boolean;
    throwOnError: false;
  }): Promise<ReadOnlyResponse | null>;
  async function send(sendOptions?: {
    runOnce?: boolean;
    throwOnError: boolean;
  }): Promise<ReadOnlyResponse | null> {
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
        text(): Promise<string>;
        json(): Promise<unknown>;
      }> = async (_bail, attempt) => {
        debugLog(`Sending (queue ${dataToSend}) (attempt ${attempt})`);

        if (!enabled) {
          return {
            status: 200,
            text: async () => 'OK',
            json: async () => ({}),
          };
        }

        const response = await http
          .post(options.endpoint, buffer, {
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
              Authorization: `Bearer ${options.token}`,
              'User-Agent': `${options.name}/${version}`,
              ...headers(),
            },
            timeout: options.timeout,
            fetchImplementation: pluginOptions.__testing?.fetch,
            logger: options.logger,
          })
          .catch(error => {
            debugLog(`Attempt ${attempt} failed: ${error.message}`);
            return Promise.reject(error);
          });

        if (response.status >= 200 && response.status < 300) {
          return response;
        }

        debugLog(`Attempt ${attempt} failed: ${response.status}`);
        throw new Error(`${response.status}: ${response.statusText} ${await response.text()}`);
      };

      const response = await retry(sendReport, {
        retries: options.maxRetries,
        minTimeout: options.minTimeout,
        factor: 2,
      });

      if (response.status < 200 || response.status >= 300) {
        throw new Error(
          `[hive][${prefix}] POST ${options.endpoint} failed with status code ${response.status}. ${await response.text()}`,
        );
      }

      debugLog(`Sent!`);

      if (!runOnce) {
        schedule();
      }
      return response;
    } catch (error: any) {
      if (!runOnce) {
        schedule();
      }

      if (sendOptions?.throwOnError) {
        throw error;
      }

      options.logger.error(
        `[hive][${prefix}] POST ${options.endpoint} failed with status ${error.message}`,
      );

      return null;
    }
  }

  async function dispose() {
    debugLog('Disposing');
    if (timeoutID) {
      clearTimeout(timeoutID);
    }

    if (inProgressCaptures.length) {
      await Promise.all(inProgressCaptures);
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
