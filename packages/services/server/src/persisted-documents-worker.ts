import 'reflect-metadata';
import { parentPort } from 'node:worker_threads';
import fastify from 'fastify';
import { createWorker } from '../../api/src/modules/app-deployments/worker/persisted-documents-worker';
import { env } from './environment';

if (!parentPort) {
  throw new Error('This script must be run as a worker.');
}

const logger = fastify().log;

createWorker(parentPort, logger, {
  clickhouse: env.clickhouse,
  s3: env.s3,
});
