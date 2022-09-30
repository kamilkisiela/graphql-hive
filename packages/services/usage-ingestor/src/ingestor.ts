import { Kafka, KafkaMessage, logLevel } from 'kafkajs';
import { createClient } from '@clickhouse/client';
import { decompress } from '@hive/usage-common';
import { errors, processTime, reportMessageBytes } from './metrics';
import { ClickHouseConfig, createWriter } from './writer';
import type { S3Config } from './fallback';
import { createProcessor } from './processor';

import type { FastifyLoggerInstance } from '@hive/service-common';
import type { RawReport } from '@hive/usage-common';
import { createBatcher } from './batcher';
import { createFallback } from './fallback';

enum Status {
  Waiting,
  Connected,
  Ready,
  Stopped,
}

const levelMap = {
  [logLevel.NOTHING]: 'trace',
  [logLevel.ERROR]: 'error',
  [logLevel.WARN]: 'warn',
  [logLevel.INFO]: 'info',
  [logLevel.DEBUG]: 'debug',
} as const;

export function createIngestor(config: {
  logger: FastifyLoggerInstance;
  clickhouse: ClickHouseConfig;
  clickhouseCloud: ClickHouseConfig | null;
  batching: {
    intervalInMS: number;
    limitInBytes: number;
  };
  kafka: {
    topic: string;
    consumerGroup: string;
    concurrency: number;
    connection:
      | {
          mode: 'hosted';
          key: string;
          user: string;
          broker: string;
        }
      | {
          mode: 'docker';
          broker: string;
        };
  };
  s3: S3Config | null;
}) {
  const { logger } = config;

  const kafka = new Kafka({
    clientId: 'usage-ingestor',
    ...(config.kafka.connection.mode === 'hosted'
      ? {
          ssl: true,
          sasl: {
            mechanism: 'plain',
            username: config.kafka.connection.user,
            password: config.kafka.connection.key,
          },
          brokers: [config.kafka.connection.broker],
        }
      : {
          brokers: [config.kafka.connection.broker],
        }),
    logLevel: logLevel.INFO,
    logCreator() {
      return entry => {
        logger[levelMap[entry.level]]({
          ...entry.log,
          message: undefined,
          timestamp: undefined,
          msg: `[${entry.namespace}] ${entry.log.message}`,
          time: new Date(entry.log.timestamp).getTime(),
        });
      };
    },
  });
  const consumer = kafka.consumer({
    groupId: config.kafka.consumerGroup,
    retry: {
      retries: 2,
    },
    // Recommended by Azure EventHub https://docs.microsoft.com/en-us/azure/event-hubs/apache-kafka-configurations
    sessionTimeout: 30_000,
    heartbeatInterval: 3_000,
    metadataMaxAge: 180_000,
  });

  consumer.on('consumer.stop', async () => {
    logger.warn('Consumer stopped');
  });

  consumer.on('consumer.crash', async ev => {
    logger.error('Consumer crashed (restart=%s, error=%s)', ev.payload.restart, ev.payload.error);

    if (ev.payload.restart) {
      return;
    }

    logger.info('Restarting consumer...');
    await start();
  });

  consumer.on('consumer.disconnect', async () => {
    logger.warn('Consumer disconnected');
  });

  const client = createClient({
    host: `${config.clickhouse.protocol ?? 'https'}://${config.clickhouse.host}:${config.clickhouse.port}`,
    connect_timeout: 10_000,
    request_timeout: 60_000,
    max_open_connections: 10,

    compression: {
      response: false,
      request: true,
    },

    username: config.clickhouse.username,
    password: config.clickhouse.password,

    application: 'usage-ingestor',
    clickhouse_settings: {
      wait_end_of_query: config.clickhouse.wait_end_of_query,
      wait_for_async_insert: config.clickhouse.wait_for_async_insert,
    },
  });

  const cloudClient = config.clickhouseCloud
    ? createClient({
        host: `${config.clickhouseCloud.protocol ?? 'https'}://${config.clickhouseCloud.host}:${
          config.clickhouseCloud.port
        }`,
        connect_timeout: 10_000,
        request_timeout: 60_000,
        max_open_connections: 10,

        compression: {
          response: false,
          request: true,
        },

        username: config.clickhouseCloud.username,
        password: config.clickhouseCloud.password,

        application: 'usage-ingestor',
        clickhouse_settings: {
          wait_end_of_query: config.clickhouseCloud.wait_end_of_query,
          wait_for_async_insert: config.clickhouseCloud.wait_for_async_insert,
        },
      })
    : null;

  const processor = createProcessor({ logger });

  const fallback = config.s3
    ? createFallback({
        s3: config.s3,
        clickhouse: client,
        logger,
        intervalInMS: config.batching.intervalInMS,
      })
    : null;

  const writer = createWriter({
    clickhouse: client,
    clickhouseCloud: cloudClient,
    logger,
    fallback,
  });

  const batcher = createBatcher({
    logger,
    writer,
    intervalInMS: config.batching.intervalInMS,
    limitInBytes: config.batching.limitInBytes,
  });

  const fallbackSync = fallback?.sync();

  async function stop() {
    logger.info('Started Usage Ingestor shutdown...');

    status = Status.Stopped;
    await consumer.disconnect();
    await fallbackSync?.stop();
    await batcher.stop();
    logger.info('Closing ClickHouse clients...');
    await Promise.all([client.close(), cloudClient?.close()]);
    logger.info(`Consumer disconnected`);

    logger.info('Usage Ingestor stopped');
  }

  async function start() {
    logger.info('Starting Usage Ingestor...');

    status = Status.Waiting;

    batcher.start();

    logger.info('Connecting Kafka Consumer');
    await consumer.connect();

    status = Status.Connected;

    logger.info('Subscribing to Kafka topic: %s', config.kafka.topic);
    await consumer.subscribe({
      topic: config.kafka.topic,
      fromBeginning: true,
    });
    logger.info('Running consumer');
    await consumer.run({
      autoCommit: true,
      autoCommitThreshold: 2,
      partitionsConsumedConcurrently: config.kafka.concurrency,
      eachMessage({ message }) {
        const stopTimer = processTime.startTimer();
        return processMessage({
          message,
          processor,
          batcher,
        })
          .catch(error => {
            errors.inc();
            return Promise.reject(error);
          })
          .finally(() => {
            stopTimer();
          });
      },
    });
    logger.info('Kafka is ready');
    status = Status.Ready;
  }

  let status: Status = Status.Waiting;

  return {
    readiness() {
      return status === Status.Ready;
    },
    start,
    stop,
  };
}

async function processMessage({
  processor,
  batcher,
  message,
}: {
  processor: ReturnType<typeof createProcessor>;
  batcher: ReturnType<typeof createBatcher>;
  message: KafkaMessage;
}) {
  reportMessageBytes.observe(message.value!.byteLength);
  // Decompress and parse the message to get a list of reports
  const rawReports: RawReport[] = JSON.parse((await decompress(message.value!)).toString());

  const { operations, registryRecords, legacy } = await processor.processReports(rawReports);

  batcher.add({
    operations,
    operation_collection: registryRecords,
    legacy: {
      operations: legacy.operations,
      operation_collection: legacy.registryRecords,
    },
  });
}
