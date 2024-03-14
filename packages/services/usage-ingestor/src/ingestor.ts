import { Kafka, KafkaMessage, logLevel } from 'kafkajs';
import type { ServiceLogger } from '@hive/service-common';
import type { RawReport } from '@hive/usage-common';
import { decompress } from '@hive/usage-common';
import type { KafkaEnvironment } from './environment';
import {
  errors,
  ingestedOperationRegistryFailures,
  ingestedOperationRegistryWrites,
  ingestedOperationsFailures,
  ingestedOperationsWrites,
  processDuration,
  reportMessageBytes,
} from './metrics';
import { createProcessor } from './processor';
import { ClickHouseConfig, createWriter } from './writer';

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

const retryOnFailureSymbol = Symbol.for('retry-on-failure');

function shouldRetryOnFailure(error: any) {
  return error[retryOnFailureSymbol] === true;
}

export function createIngestor(config: {
  logger: ServiceLogger;
  clickhouse: ClickHouseConfig;
  kafka: {
    topic: string;
    consumerGroup: string;
    concurrency: number;
    connection: KafkaEnvironment['connection'];
  };
}) {
  const { logger } = config;

  const kafka = new Kafka({
    clientId: 'usage-ingestor',
    brokers: [config.kafka.connection.broker],
    ssl: config.kafka.connection.ssl,
    sasl:
      config.kafka.connection.sasl?.mechanism === 'plain'
        ? {
            mechanism: 'plain',
            username: config.kafka.connection.sasl.username,
            password: config.kafka.connection.sasl.password,
          }
        : config.kafka.connection.sasl?.mechanism === 'scram-sha-256'
          ? {
              mechanism: 'scram-sha-256',
              username: config.kafka.connection.sasl.username,
              password: config.kafka.connection.sasl.password,
            }
          : config.kafka.connection.sasl?.mechanism === 'scram-sha-512'
            ? {
                mechanism: 'scram-sha-512',
                username: config.kafka.connection.sasl.username,
                password: config.kafka.connection.sasl.password,
              }
            : undefined,
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
    heartbeatInterval: 3000,
    metadataMaxAge: 180_000,
  });

  async function stop() {
    logger.info('Started Usage Ingestor shutdown...');

    status = Status.Stopped;
    await consumer.disconnect();
    writer.destroy();
    logger.info(`Consumer disconnected`);

    logger.info('Usage Ingestor stopped');
  }

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

  async function start() {
    logger.info('Starting Usage Ingestor...');

    status = Status.Waiting;

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
        const stopTimer = processDuration.startTimer();
        return processMessage({
          message,
          logger,
          processor,
          writer,
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

  const processor = createProcessor({ logger });
  const writer = createWriter({
    clickhouse: config.clickhouse,
    logger,
  });

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
  writer,
  message,
  logger,
}: {
  processor: ReturnType<typeof createProcessor>;
  writer: ReturnType<typeof createWriter>;
  message: KafkaMessage;
  logger: ServiceLogger;
}) {
  reportMessageBytes.observe(message.value!.byteLength);
  // Decompress and parse the message to get a list of reports
  const rawReports: RawReport[] = JSON.parse((await decompress(message.value!)).toString());

  const { registryRecords, operations, subscriptionOperations } =
    await processor.processReports(rawReports);

  try {
    // .then and .catch looks weird but async/await with try/catch and Promise.all is even weirder
    await Promise.all([
      writer
        .writeRegistry(registryRecords)
        .then(value => {
          ingestedOperationRegistryWrites.inc(registryRecords.length);
          return Promise.resolve(value);
        })
        .catch(error => {
          ingestedOperationRegistryFailures.inc(registryRecords.length);
          return Promise.reject(error);
        }),
      writer
        .writeOperations(operations)
        .then(value => {
          ingestedOperationsWrites.inc(operations.length);
          return Promise.resolve(value);
        })
        .catch(error => {
          ingestedOperationsFailures.inc(operations.length);
          // We want to retry the kafka message only if the write to operations table fails.
          // Why? Because if we retry the message for operation_registry, we will have duplicate.
          // One write could succeed, the other one could fail.
          // Let's stick to the operations table for now.
          error[retryOnFailureSymbol] = true;
          return Promise.reject(error);
        }),
      writer
        .writeSubscriptionOperations(subscriptionOperations)
        .then(value => {
          ingestedOperationsWrites.inc(subscriptionOperations.length);
          return Promise.resolve(value);
        })
        .catch(error => {
          ingestedOperationsFailures.inc(subscriptionOperations.length);
          // We want to retry the kafka message only if the write to operations table fails.
          // Why? Because if we retry the message for operation_registry, we will have duplicate.
          // One write could succeed, the other one could fail.
          // Let's stick to the operations table for now.
          error[retryOnFailureSymbol] = true;
          return Promise.reject(error);
        }),
    ]);
  } catch (error) {
    logger.error(error);

    if (shouldRetryOnFailure(error)) {
      throw error;
    }
  }
}
