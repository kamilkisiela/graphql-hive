import { version } from '../version.js';
import { http } from './http-client.js';
import type { Logger } from './types.js';

type ReadOnlyResponse = Pick<Response, 'status' | 'text' | 'json' | 'statusText'>;

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
    data,
    body,
    headers = () => ({}),
  }: {
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
      options.logger.info(msg);
    }
  }

  function errorLog(msg: string) {
    options.logger.error(msg);
  }

  let scheduled = false;
  let inProgressCaptures: Promise<void>[] = [];

  function capture(event: TEvent | Promise<TEvent>) {
    if (event instanceof Promise) {
      const promise = captureAsync(event);
      inProgressCaptures.push(promise);
      void promise.finally(() => {
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
      setImmediate(() => send({ throwOnError: false, skipSchedule: true }));
    }
  }

  function sendImmediately(event: TEvent): Promise<ReadOnlyResponse | null> {
    data.set(event);
    debugLog('Sending immediately');
    return send({ throwOnError: true, skipSchedule: true });
  }

  async function send(sendOptions?: {
    throwOnError?: boolean;
    skipSchedule: boolean;
  }): Promise<ReadOnlyResponse | null> {
    if (!data.size() || !enabled) {
      if (!sendOptions?.skipSchedule) {
        schedule();
      }
      return null;
    }

    const buffer = await body();
    const dataToSend = data.size();

    data.clear();

    debugLog(`Sending report (queue ${dataToSend})`);
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
        retry: {
          retries: options.maxRetries,
          factor: 2,
        },
        logger: options.logger,
        fetchImplementation: pluginOptions.__testing?.fetch,
      })
      .then(res => {
        debugLog(`Report sent!`);
        return res;
      })
      .catch(error => {
        errorLog(`Failed to send report.`);

        if (sendOptions?.throwOnError) {
          throw error;
        }

        return null;
      })
      .finally(() => {
        if (!sendOptions?.skipSchedule) {
          schedule();
        }
      });

    return response;
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
      skipSchedule: true,
      throwOnError: false,
    });
  }

  return {
    capture,
    sendImmediately,
    dispose,
  };
}
