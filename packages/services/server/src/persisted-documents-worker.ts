import 'reflect-metadata';
import { parentPort } from 'node:worker_threads';
import { Logger } from '@hive/api';
import { createWorker } from '../../api/src/modules/app-deployments/worker/persisted-documents-worker';
import { env } from './environment';

if (!parentPort) {
  throw new Error('This script must be run as a worker.');
}
const pp = parentPort;

function createLogger(bindings: Record<string, unknown> = {}): Logger {
  return {
    child(newBindings) {
      return createLogger({ ...bindings, ...newBindings });
    },
    debug(...args) {
      pp.postMessage({ event: 'log', level: 'debug', args, bindings });
    },
    error(...args) {
      pp.postMessage({ event: 'log', level: 'error', args, bindings });
    },
    fatal(...args) {
      pp.postMessage({ event: 'log', level: 'fatal', args, bindings });
    },
    info(...args) {
      pp.postMessage({ event: 'log', level: 'info', args, bindings });
    },
    trace(...args) {
      pp.postMessage({ event: 'log', level: 'trace', args, bindings });
    },
    warn(...args) {
      pp.postMessage({ event: 'log', level: 'warn', args, bindings });
    },
  };
}

createWorker(parentPort, createLogger(), {
  clickhouse: env.clickhouse,
  s3: env.s3,
});
