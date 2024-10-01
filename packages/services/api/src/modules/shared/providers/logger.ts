import { Injectable, InjectionToken } from 'graphql-modules';
import type { FastifyBaseLogger } from 'packages/services/service-common/src/fastify';

export type LogFn = (msg: string, ...args: unknown[]) => void;

export type FastifyLogger = FastifyBaseLogger;
export const FASTIFY_LOGGER = new InjectionToken<FastifyBaseLogger>('FastifyLogger');

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
