import pino from 'pino';
import type { Logger } from 'pino';

declare global {
  // eslint-disable-next-line no-var
  var logger: Logger;
}

export function getLogger(req?: any) {
  if (req && isLoggerEnhancedReq(req)) {
    return req.log;
  }

  // eslint-disable-next-line logical-assignment-operators
  if (!globalThis.logger) {
    globalThis.logger = pino();
  }

  return globalThis.logger;
}

function isLoggerEnhancedReq(req: any): req is { log: Logger } {
  return typeof req.log !== 'undefined';
}
