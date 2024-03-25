import { CompressionTypes, Kafka, logLevel, Partitioners, RetryOptions } from 'kafkajs';
import type { ServiceLogger } from '@hive/service-common';
import type { RawOperationMap, RawReport } from '@hive/usage-common';
import { compress } from '@hive/usage-common';
import { calculateChunkSize, createKVBuffer, isBufferTooBigError } from './buffer';
import type { KafkaEnvironment } from './environment';
import {
  bufferFlushes,
  compressDuration,
  estimationError,
  kafkaDuration,
  rawOperationFailures,
  rawOperationWrites,
} from './metrics';

enum Status {
  Waiting,
  Ready,
  Unhealthy,
  Stopped,
}

const levelMap = {
  [logLevel.NOTHING]: 'trace',
  [logLevel.ERROR]: 'error',
  [logLevel.WARN]: 'warn',
  [logLevel.INFO]: 'info',
  [logLevel.DEBUG]: 'debug',
} as const;

const retryOptions = {
  maxRetryTime: 15 * 1000,
  initialRetryTime: 300,
  factor: 0.2,
  multiplier: 2,
  retries: 3,
} satisfies RetryOptions; // why satisfies? To be able to use `retryOptions.retries` and get `number` instead of `number | undefined`

export function splitReport(report: RawReport, numOfChunks: number) {
  const reports: RawReport[] = [];
  const operationMapLength = Object.keys(report.map).length;

  const keyReportIndexMap: {
    [operationMapKey: string]: number;
  } = {};
  const operationMapEntries = Object.entries(report.map);
  let endedAt = 0;
  for (let chunkIndex = 0; chunkIndex < numOfChunks; chunkIndex++) {
    const chunkSize = calculateChunkSize(operationMapLength, numOfChunks, chunkIndex);
    const start = endedAt;
    const end = start + chunkSize;
    endedAt = end;
    const chunk = operationMapEntries.slice(start, end);

    const operationMap: RawOperationMap = {};
    for (const [key, record] of chunk) {
      keyReportIndexMap[key] = chunkIndex;
      operationMap[key] = record;
    }

    reports.push({
      id: `${report.id}--chunk-${chunkIndex}`,
      size: 0,
      target: report.target,
      map: operationMap,
      operations: [],
    });
  }

  for (const op of report.operations) {
    const chunkIndex = keyReportIndexMap[op.operationMapKey];
    reports[chunkIndex].operations.push(op);
    reports[chunkIndex].size += 1;
  }

  return reports;
}

export function createUsage(config: {
  logger: ServiceLogger;
  kafka: {
    topic: string;
    buffer: {
      /**
       * The maximum number of operations to buffer before flushing to Kafka.
       */
      size: number;
      /**
       * In milliseconds
       */
      interval: number;
      /**
       * Use smart estimator to estimate the buffer limit
       */
      dynamic: boolean;
    };
    connection: KafkaEnvironment['connection'];
  };
  onStop(reason: string): Promise<void>;
}) {
  const { logger } = config;

  const kafka = new Kafka({
    clientId: 'usage',
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
    // settings recommended by Azure EventHub https://docs.microsoft.com/en-us/azure/event-hubs/apache-kafka-configurations
    requestTimeout: 60_000, //
    connectionTimeout: 5000,
    authenticationTimeout: 5000,
    retry: retryOptions,
  });
  const producer = kafka.producer({
    // settings recommended by Azure EventHub https://docs.microsoft.com/en-us/azure/event-hubs/apache-kafka-configurations
    metadataMaxAge: 180_000,
    createPartitioner: Partitioners.LegacyPartitioner,
    retry: retryOptions,
  });
  const buffer = createKVBuffer<RawReport>({
    logger,
    size: config.kafka.buffer.size,
    interval: config.kafka.buffer.interval,
    limitInBytes: 990_000, // 1MB is the limit of a single request to EventHub, let's keep it below that
    useEstimator: config.kafka.buffer.dynamic,
    calculateReportSize(report) {
      return Object.keys(report.map).length;
    },
    split(report, numOfChunks) {
      return splitReport(report, numOfChunks);
    },
    onRetry(reports) {
      // Because we do a retry, we need to decrease the number of failures
      const numOfOperations = reports.reduce((sum, report) => report.size + sum, 0);
      rawOperationFailures.dec(numOfOperations);
    },
    async sender(reports, estimatedSizeInBytes, batchId, validateSize) {
      const numOfOperations = reports.reduce((sum, report) => report.size + sum, 0);
      try {
        const compressLatencyStop = compressDuration.startTimer();
        const value = await compress(JSON.stringify(reports)).finally(() => {
          compressLatencyStop();
        });
        const stopTimer = kafkaDuration.startTimer();

        estimationError.observe(
          Math.abs(estimatedSizeInBytes - value.byteLength) / value.byteLength,
        );

        validateSize(value.byteLength);
        bufferFlushes.inc();
        const meta = await producer
          .send({
            topic: config.kafka.topic,
            compression: CompressionTypes.None, // Event Hubs doesn't support compression
            messages: [
              {
                value,
              },
            ],
          })
          .finally(() => {
            stopTimer();
          });
        if (meta[0].errorCode) {
          rawOperationFailures.inc(numOfOperations);
          logger.error(`Failed to flush (id=%s, errorCode=%s)`, batchId, meta[0].errorCode);
        } else {
          rawOperationWrites.inc(numOfOperations);
          logger.info(`Flushed (id=%s, operations=%s)`, batchId, numOfOperations);
        }

        status = Status.Ready;
      } catch (error: any) {
        rawOperationFailures.inc(numOfOperations);

        if (isBufferTooBigError(error)) {
          logger.debug('Buffer too big, retrying (id=%s, error=%s)', batchId, error.message);
        } else {
          status = Status.Unhealthy;
          logger.error(`Failed to flush (id=%s, error=%s)`, batchId, error.message);
          scheduleReconnect();
        }

        throw error;
      }
    },
  });

  let status: Status = Status.Waiting;

  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let reconnectCounter = 0;
  function scheduleReconnect() {
    logger.info('Scheduling reconnect');
    if (reconnectTimeout) {
      logger.info('Reconnect was already scheduled. Waiting...');
      return;
    }

    reconnectCounter++;

    if (reconnectCounter > retryOptions.retries) {
      const message = 'Failed to reconnect Kafka producer. Too many retries.';
      logger.error(message);
      status = Status.Unhealthy;
      void config.onStop(message);
      return;
    }

    logger.info('Reconnecting in 1 second... (attempt=%s)', reconnectCounter);
    reconnectTimeout = setTimeout(() => {
      logger.info('Reconnecting Kafka producer');
      status = Status.Waiting;
      producer
        .connect()
        .then(() => {
          logger.info('Kafka producer reconnected');
          reconnectCounter = 0;
        })
        .catch(error => {
          logger.error('Failed to reconnect Kafka producer: %s', error.message);
          logger.info('Reconnecting in 2 seconds...');
          setTimeout(scheduleReconnect, 2000);
        })
        .finally(() => {
          if (reconnectTimeout != null) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
          }
        });
    }, 1000);
  }

  producer.on(producer.events.CONNECT, () => {
    logger.info('Kafka producer: connected');
    status = Status.Ready;
  });

  producer.on(producer.events.DISCONNECT, () => {
    logger.info('Kafka producer: disconnected');
    status = Status.Stopped;
  });

  producer.on(producer.events.REQUEST_TIMEOUT, () => {
    logger.info('Kafka producer: request timeout');
  });

  async function stop() {
    logger.info('Started Usage shutdown...');

    status = Status.Stopped;
    await buffer.stop();
    logger.info(`Buffering stopped`);
    await producer.disconnect();
    logger.info(`Producer disconnected`);

    logger.info('Usage stopped');
  }

  return {
    collect(report: RawReport) {
      if (status !== Status.Ready) {
        throw new Error('Usage is not ready yet');
      }

      buffer.add(report);
    },
    readiness() {
      return status === Status.Ready;
    },
    async start() {
      logger.info('Starting Kafka producer');
      await producer.connect();
      buffer.start();
      status = Status.Ready;
      logger.info('Kafka producer is ready');
    },
    stop,
  };
}
