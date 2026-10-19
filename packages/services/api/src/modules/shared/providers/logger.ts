import type { MessagePort, Worker } from 'node:worker_threads';
import type { LogLevel } from 'fastify';
import { Injectable } from 'graphql-modules';
import { getRequestId, requestIdStorage } from '@hive/service-common';

export type LogFn = (msg: string, ...args: unknown[]) => void;

function notImplemented(method: string) {
  return () => {
    throw new Error(`Method Logger.${method} not implemented`);
  };
}

@Injectable()
export class Logger {
  info: LogFn = notImplemented('info');
  warn: LogFn = notImplemented('warn');
  error: LogFn = notImplemented('error');
  fatal: LogFn = notImplemented('fatal');
  trace: LogFn = notImplemented('trace');
  debug: LogFn = notImplemented('debug');
  child: (bindings: Record<string, unknown>) => Logger = notImplemented('child');
}

function noop() {}

export class NoopLogger extends Logger {
  info = noop;
  warn = noop;
  error = noop;
  fatal = noop;
  trace = noop;
  debug = noop;
  child = () => this;
}

export type MessagePortLog = {
  event: 'log';
  bindings: Record<string, unknown>;
  level: Exclude<LogLevel, 'silent'>;
  args: [string, ...unknown[]];
};

/**
 * Create a logger that posts the logs to the message port.
 * The main use-case of this is to forward logs from a worker thread to the main thread.
 */
export function createMessagePortLogger(
  port: MessagePort,
  bindings: Record<string, unknown> = {},
): Logger {
  const post = (level: MessagePortLog['level'], args: MessagePortLog['args']) => {
    const requestId = getRequestId();
    port.postMessage({
      event: 'log',
      level,
      args,
      bindings: requestId && !('requestId' in bindings) ? { ...bindings, requestId } : bindings,
    } satisfies MessagePortLog);
  };

  return {
    child(newBindings) {
      return createMessagePortLogger(port, { ...bindings, ...newBindings });
    },
    debug: (...args) => post('debug', args),
    error: (...args) => post('error', args),
    fatal: (...args) => post('fatal', args),
    info: (...args) => post('info', args),
    trace: (...args) => post('trace', args),
    warn: (...args) => post('warn', args),
  };
}

/**
 * Register a logger from the message port to log to this threads logger.
 * A `requestId` binding is restored as the active request id, which the main-thread logger reads.
 */
export function registerWorkerLogging(logger: Logger, worker: Worker, workerId: string) {
  worker.on('message', (data: MessagePortLog) => {
    if (!('event' in data && data.event === 'log')) {
      return;
    }

    const emit = () =>
      logger
        .child({
          ...data.bindings,
          workerId,
        })
        [data.level](...data.args);

    const requestId = data.bindings.requestId;
    if (typeof requestId === 'string') {
      requestIdStorage.run({ requestId }, emit);
    } else {
      emit();
    }
  });
}
