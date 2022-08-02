import * as Sentry from '@sentry/node';
import type { FastifyLoggerInstance } from '@hive/service-common';
import { Queue, QueueScheduler, Worker, Job } from 'bullmq';
import Redis, { Redis as RedisInstance } from 'ioredis';
import pTimeout from 'p-timeout';
import type { RenderedTemplate } from './templates';

const DAY_IN_SECONDS = 86_400;

export function createScheduler(config: {
  logger: FastifyLoggerInstance;
  redis: {
    host: string;
    port: number;
    password: string;
  };
  queueName: string;
}) {
  let redisConnection: RedisInstance | null;
  let queue: Queue | null;
  let queueScheduler: QueueScheduler | null;
  let stopped = false;
  const logger = config.logger;

  async function clearBull() {
    logger.info('Clearing BullMQ...');

    try {
      queue?.removeAllListeners();
      queueScheduler?.removeAllListeners(),
        await pTimeout(Promise.all([queue?.close(), queueScheduler?.close()]), 5000, 'BullMQ close timeout');
    } catch (e) {
      logger.error('Failed to stop queues', e);
    } finally {
      queue = null;
      queueScheduler = null;
      logger.info('BullMQ stopped');
    }
  }

  async function initQueueAndWorkers() {
    if (!redisConnection) {
      return;
    }

    const prefix = 'hive-emails';

    queueScheduler = new QueueScheduler(config.queueName, {
      prefix,
      connection: redisConnection,
      sharedConnection: true,
    });

    queue = new Queue(config.queueName, {
      prefix,
      connection: redisConnection,
      sharedConnection: true,
    });

    // Wait for Queues and Scheduler to be ready
    await Promise.all([queueScheduler.waitUntilReady(), queue.waitUntilReady()]);

    const worker = new Worker<RenderedTemplate>(
      config.queueName,
      async job => {
        console.log(job);
        // if (job.attemptsMade < config.maxAttempts) {
        //   config.logger.debug(
        //     'Calling webhook (job=%s, attempt=%d of %d)',
        //     job.name,
        //     job.attemptsMade + 1,
        //     config.maxAttempts
        //   );
        //   await got.post(job.data.endpoint, {
        //     headers: {
        //       Accept: 'application/json',
        //       'Accept-Encoding': 'gzip, deflate, br',
        //       'Content-Type': 'application/json',
        //     },
        //     timeout: {
        //       request: 10_000,
        //     },
        //     json: job.data.event,
        //   });
        // } else {
        //   config.logger.warn('Giving up on webhook (job=%s)', job.name);
        // }
      },
      {
        prefix,
        connection: redisConnection,
        sharedConnection: true,
      }
    );

    worker.on('error', onError('webhookWorker'));
    worker.on('failed', onFailed);

    // Wait for Workers
    await worker.waitUntilReady();
  }

  async function start() {
    redisConnection = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryStrategy(times) {
        return Math.min(times * 500, 2000);
      },
      reconnectOnError(error) {
        onError('redis:reconnectOnError')(error);
        return 1;
      },
      db: 0,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    redisConnection.on('error', err => {
      onError('redis:error')(err);
    });

    redisConnection.on('connect', () => {
      logger.info('Redis connection established');
    });

    redisConnection.on('ready', async () => {
      logger.info('Redis connection ready... creating queues and workers...');
      await initQueueAndWorkers();
    });

    redisConnection.on('close', () => {
      logger.info('Redis connection closed');
    });

    redisConnection.on('reconnecting', timeToReconnect => {
      logger.info('Redis reconnecting in %s', timeToReconnect);
    });

    redisConnection.on('end', async () => {
      logger.info('Redis ended - no more reconnections will be made');
      await stop();
    });
  }

  function onError(source: string) {
    return (error: Error) => {
      logger.error(`onError called from source ${source}`, error);
      Sentry.captureException(error, {
        extra: {
          error,
          source,
        },
        level: 'error',
      });
    };
  }

  function onFailed(job: Job, error: Error) {
    logger.debug(`Job %s failed after %s attempts, reason: %s`, job.name, job.attemptsMade, job.failedReason);
    logger.error(error);
  }

  async function stop() {
    logger.info('Started Usage shutdown...');

    stopped = true;

    await clearBull();

    if (redisConnection) {
      logger.info('Stopping Redis...');

      try {
        redisConnection.disconnect(false);
      } catch (e) {
        logger.error('Failed to stop Redis connection', e);
      } finally {
        redisConnection = null;
        queue = null;
        logger.info('Redis stopped');
      }
    }

    logger.info('Existing');
    process.exit(0);
  }

  async function schedule(email: RenderedTemplate) {
    if (!queue) {
      throw new Error('Queue not initialized');
    }

    const jobName = email.jobId;
    config.logger.debug(`Schedule ${jobName}`);

    return queue
      .add(jobName, email, {
        jobId: jobName,
        // We don't want to remove completed jobs, because it tells us that the job has been processed
        // and we avoid sending the same email twice.
        removeOnComplete: {
          // Let's keep the job longer than a full month, just in case :)
          age: DAY_IN_SECONDS * 32,
        },
      })
      .then(result => {
        config.logger.debug(`Scheduled ${jobName}`);
        return Promise.resolve(result);
      });
  }

  return {
    schedule,
    start,
    stop,
    readiness() {
      if (stopped) {
        return false;
      }

      return queue !== null && redisConnection !== null && redisConnection?.status === 'ready';
    },
  };
}
