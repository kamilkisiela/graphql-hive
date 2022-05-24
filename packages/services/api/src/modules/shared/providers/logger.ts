import { Injectable } from 'graphql-modules';

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
