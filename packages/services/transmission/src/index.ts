import 'reflect-metadata';
import { cpus, hostname } from 'node:os';
import { Logger, run } from 'graphile-worker';
import pg from 'pg';
import {
  createServer,
  registerShutdown,
  registerTRPC,
  startHeartbeats,
  startMetrics,
} from '@hive/service-common';
import { createStorage } from '@hive/storage';
import { captureException, init as initSentry } from '@sentry/node';
import { createConnectionString } from './connection-string.js';
import { env } from './environment.js';
import { getEmailProviderHistory } from './notifications/email/providers.js';
import { taskList, taskRouter } from './tasks.js';
import type { TrpcContext } from './trpc.js';
import { enhanceTaskList } from './utils.js';

const numOfCPUs = cpus().length;

// TODO: OTEL tracing (discuss it)

async function main() {
  if (env.sentry) {
    initSentry({
      serverName: hostname(),
      dist: 'transmission',
      enabled: !!env.sentry,
      environment: env.environment,
      dsn: env.sentry.dsn,
      release: env.release,
    });
  }

  const server = await createServer({
    name: 'transmission',
    sentryErrorHandler: true,
    log: {
      level: env.log.level,
      requests: env.log.requests,
    },
  });

  const workerLogger = new Logger(scope => {
    const logger = server.log.child(scope);
    return (level, msg, meta) => {
      switch (level) {
        case 'debug':
          logger.debug({ ...meta, msg });
          break;
        case 'info':
          logger.info({ ...meta, msg });
          break;
        case 'warning':
          logger.warn({ ...meta, msg });
          break;
        case 'error':
          logger.error({ ...meta, msg });
          break;
      }
    };
  });

  try {
    const connectionString = createConnectionString(env.postgres);
    // In development: 2 workers
    // In other environments: number of CPUs (at least 1 :D - in case the length is 0 for some reason)
    const concurrency = env.environment === 'development' ? 2 : numOfCPUs > 1 ? numOfCPUs : 1;

    // TODO: gracefully handle connection errors and stuff like that
    const lockClient = new pg.Client({
      connectionString,
    });
    await lockClient.connect();

    const storage = await createStorage(connectionString, concurrency);
    await storage.isReady();

    const runner = await run({
      connectionString,
      // Match it with the rest of the tables
      schema: 'graphile_worker',
      concurrency,
      maxPoolSize: concurrency,
      useNodeTime: true,
      // Wait for 10 seconds for graceful shutdown
      gracefulShutdownAbortTimeout: 10_000,
      minResetLockedInterval: 10_000,
      // Release locks after 60 seconds
      maxResetLockedInterval: 60_000,
      logger: workerLogger,
      // disable automatic graceful shutdown on SIGINT, SIGTERM, etc
      noHandleSignals: true,
      taskList: enhanceTaskList({ storage }, lockClient, taskList.getTaskList()),
      crontab: [
        // // Run the alerts cron task every minute,
        // // retry up to 3 times, and give it a high priority.
        // '* * * * * alertsCronTask ?max=3&jobKey=alertsCronTask&jobKeyMode=replace&priority=10',
        // Run the cleanup task every hour
        '0 * * * * monthlyDeduplicationCleanupTask ?max=5&priority=8',
      ].join('\n'),
    });

    taskList.registerEvents(runner.events);

    // Log lock events
    lockClient.on('error', error => {
      server.log.error(error, 'Lock client error');
      captureException(error, {
        extra: {
          event: 'lockClient:error',
        },
        level: 'error',
      });
    });
    lockClient.on('end', () => {
      server.log.debug('Lock client ended');
    });

    // Log worker events
    runner.events.on('worker:create', async p => {
      server.log.debug(`Worker ${p.worker.workerId} created`);
    });
    runner.events.on('worker:stop', p => {
      server.log.debug(`Worker ${p.worker.workerId} stopped`);
    });

    // Track the status of the runner
    let runnerStatus: 'running' | 'stopping' | 'stopped' = 'running';
    runner.events.once('stop', () => {
      runnerStatus = 'stopped';
    });
    runner.events.once('gracefulShutdown', () => {
      runnerStatus = 'stopping';
    });
    runner.events.once('forcefulShutdown', () => {
      runnerStatus = 'stopping';
    });

    // Log other errors
    runner.events.on('pool:listen:error', p => {
      server.log.error(p.error, 'Pool listen error');
      captureException(p.error, {
        extra: {
          event: 'pool:listen:error',
        },
        level: 'error',
      });
    });
    runner.events.on('worker:getJob:error', p => {
      server.log.error(p.error, 'Worker getJob error');
      captureException(p.error, {
        extra: {
          event: 'worker:getJob:error',
        },
        level: 'error',
      });
    });
    runner.events.on('worker:fatalError', p => {
      server.log.error(p.error, 'Worker fatal error');
      captureException(p.error, {
        extra: {
          event: 'worker:fatalError',
        },
        level: 'fatal',
      });
    });
    runner.events.on('job:failed', p => {
      server.log.error(p.error, `Job ${p.job.key ?? p.job.task_identifier} failed`);
      captureException(p.error, {
        extra: {
          event: 'job:failed',
          jobKey: p.job.key,
          taskIdentifier: p.job.task_identifier,
          attempts: p.job.attempts,
          workerId: p.worker.workerId,
        },
        level: 'error',
      });
    });

    await registerTRPC(server, {
      router: taskRouter,
      createContext({ req }) {
        return {
          req,
          runner,
          storage,
        } satisfies TrpcContext;
      },
    });

    const stopHeartbeats = env.heartbeat
      ? startHeartbeats({
          enabled: true,
          endpoint: env.heartbeat.endpoint,
          intervalInMS: 20_000,
          onError: e => server.log.error(e, `Heartbeat failed with error`),
          isReady() {
            return runnerStatus === 'running';
          },
        })
      : startHeartbeats({ enabled: false });

    // Handle shutdown
    registerShutdown({
      logger: server.log,
      async onShutdown() {
        stopHeartbeats();
        const actions: Promise<void>[] = [];

        if (runner) {
          runnerStatus = 'stopping';
          server.log.debug('Stopping worker runner');
          actions.push(runner.stop());
        }

        if (lockClient) {
          server.log.debug('Releasing lock client');
          actions.push(lockClient.end());
        }

        if (storage) {
          server.log.debug('Closing storage');
          actions.push(storage.destroy());
        }

        await Promise.all(actions);
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_health',
      handler(_req, res) {
        void res.status(200).send();
      },
    });

    server.route({
      method: ['GET', 'HEAD'],
      url: '/_readiness',
      handler(_, res) {
        void res.status(runnerStatus === 'running' ? 200 : 400).send();
      },
    });

    if (env.email.provider.provider === 'mock') {
      server.route({
        method: ['GET'],
        url: '/emails/_history',
        handler(_, res) {
          void res.status(200).send(getEmailProviderHistory());
        },
      });
    }

    await server.listen({
      port: env.http.port,
      host: '::',
    });

    if (env.prometheus) {
      await startMetrics(env.prometheus.labels.instance, env.prometheus.port);
    }
  } catch (error) {
    server.log.fatal(error);
    captureException(error, {
      level: 'fatal',
    });
    process.exit(1);
  }
}

main().catch(err => {
  captureException(err, {
    level: 'fatal',
  });
  console.error(err);
  process.exit(1);
});
