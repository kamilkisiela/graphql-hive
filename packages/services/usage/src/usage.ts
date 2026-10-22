import net from 'net';
import tls from 'tls';
import {
  CompressionTypes,
  ISocketFactory,
  Kafka,
  logLevel,
  Partitioners,
  RetryOptions,
} from 'kafkajs';
import {
  createMskIamTokenProvider,
  traceInlineSync,
  type ServiceLogger,
} from '@hive/service-common';
import type { RawOperationMap, RawReport } from '@hive/usage-common';
import { compressZstd } from '@hive/usage-common';
import * as Sentry from '@sentry/node';
import { calculateChunkSize, createKVBuffer } from './buffer';
import type { KafkaEnvironment } from './environment';
import { createFallbackQueue } from './fallback-queue';
import {
  bufferFlushes,
  compressDuration,
  droppedOversizedOperations,
  estimationError,
  fallbackDroppedOperations,
  kafkaDuration,
  rawOperationFailures,
  rawOperationWrites,
} from './metrics';

enum Status {
  Waiting = 'Waiting',
  Ready = 'Ready',
  Unhealthy = 'Unhealthy',
  Stopped = 'Stopped',
}

const levelMap = {
  [logLevel.NOTHING]: 'trace',
  [logLevel.ERROR]: 'error',
  [logLevel.WARN]: 'warn',
  [logLevel.INFO]: 'info',
  [logLevel.DEBUG]: 'debug',
} as const;

const retryOptions = {
  maxRetryTime: 30_000,
  initialRetryTime: 300,
  factor: 0.2,
  multiplier: 2,
  retries: 5,
} satisfies RetryOptions; // why satisfies? To be able to use `retryOptions.retries` and get `number` instead of `number | undefined`

export function splitReport(report: RawReport, numOfChunks: number): RawReport[] {
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

    if (chunkSize === 0) {
      // numOfChunks exceeded the number of distinct operationMapKeys - nothing to
      // assign here. Skip it rather than emitting an empty report that would become
      // its own near-empty Kafka message.
      continue;
    }

    const chunk = operationMapEntries.slice(start, end);
    const operationMap: RawOperationMap = {};
    const reportIndex = reports.length;
    for (const [key, record] of chunk) {
      keyReportIndexMap[key] = reportIndex;
      operationMap[key] = record;
    }

    reports.push({
      id: `${report.id}--chunk-${chunkIndex}`,
      size: 0,
      target: report.target,
      organization: report.organization,
      map: operationMap,
      operations: [],
    });
  }

  for (const op of report.operations) {
    const chunkIndex = keyReportIndexMap[op.operationMapKey];
    reports[chunkIndex].operations.push(op);
    reports[chunkIndex].size += 1;
  }

  if (report.subscriptionOperations) {
    for (const subscriptionOp of report.subscriptionOperations) {
      const chunkIndex = keyReportIndexMap[subscriptionOp.operationMapKey];
      const chunkReport = reports[chunkIndex];
      (chunkReport.subscriptionOperations ??= []).push(subscriptionOp);
      // report.size counts operations + subscriptionOperations (see usage-processor-2.ts) - keep that invariant per chunk.
      chunkReport.size += 1;
    }
  }

  if (report.errors) {
    for (const errorRecord of report.errors) {
      const chunkIndex = keyReportIndexMap[errorRecord.operationMapKey];
      (reports[chunkIndex].errors ??= []).push(errorRecord);
    }
  }

  if (report.appDeploymentUsageTimestamps && reports.length > 0) {
    // Not keyed by operationMapKey, so it can't be partitioned like the fields above.
    // Attach it to exactly one (guaranteed non-empty) chunk rather than duplicating it
    // into every chunk - duplication wastes Kafka bytes on every split and could
    // inflate every chunk's size by the same amount, risking that all chunks stay
    // oversized (and get dropped) because of a payload the split wasn't even about.
    reports[reports.length - 1].appDeploymentUsageTimestamps = report.appDeploymentUsageTimestamps;
  }

  return reports;
}

export function isSplittable(report: RawReport): boolean {
  return Object.keys(report.map).length > 1;
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

  // Default KafkaJS socketFactory implementation with minor optimizations for Azure
  // https://github.com/tulios/kafkajs/blob/master/src/network/socketFactory.js
  const socketFactory: ISocketFactory = ({ host, port, ssl, onConnect }) => {
    const socket = ssl
      ? tls.connect(
          Object.assign({ host, port }, !net.isIP(host) ? { servername: host } : {}, ssl),
          onConnect,
        )
      : net.connect({ host, port }, onConnect);

    // This is equivalent to kafka's "connections.max.idle.ms"
    socket.setKeepAlive(true, 180_000);
    // disable nagle's algorithm to have higher throughput since this logic
    // is already buffering messages into large payloads
    socket.setNoDelay(true);

    return socket;
  };

  const kafka = new Kafka({
    clientId: 'usage',
    brokers: config.kafka.connection.broker.split(',').map(b => b.trim()),
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
            : config.kafka.connection.sasl?.mechanism === 'aws-iam'
              ? {
                  mechanism: 'oauthbearer',
                  oauthBearerProvider: createMskIamTokenProvider(
                    config.kafka.connection.sasl.region,
                  ),
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
    requestTimeout: 30_000,
    connectionTimeout: 5_000,
    authenticationTimeout: 5_000,
    retry: retryOptions,
    socketFactory,
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
    isTooLargePayloadError(error) {
      return error instanceof Error && 'type' in error && error.type === 'MESSAGE_TOO_LARGE';
    },
    calculateReportSize(report) {
      return Object.keys(report.map).length;
    },
    isSplittable,
    split(report, numOfChunks) {
      logger.debug('Splitting report into %s chunks (id=%s)', numOfChunks, report.id);
      return splitReport(report, numOfChunks);
    },
    onRetry() {
      // No-op: an oversized-payload retry never incremented rawOperationFailures in
      // the first place (the size check throws before sender()'s try/catch, the only
      // place that increments it), so there's nothing to offset here. Retries-in-
      // progress are deliberately excluded from the failure count; buffer.ts already
      // logs every retry attempt itself.
    },
    onDrop(reports) {
      const numOfOperations = reports.reduce((sum, report) => report.size + sum, 0);
      const numOfErrors = reports.reduce(
        (sum, report) => sum + (report.errors?.reduce((s, e) => s + e.errors.length, 0) ?? 0),
        0,
      );
      droppedOversizedOperations.inc(numOfOperations);
      // These operations never went through sender()'s catch (the size check throws
      // before reaching it), so they were never counted as failing. They're being
      // permanently dropped, never collected, so count them now - and correctly never
      // decrement, since they're gone for good.
      rawOperationFailures.inc(numOfOperations);
      logger.error(
        'Dropped %s operations (%s error entries) - report cannot be split any smaller and still exceeds the Kafka size limit',
        numOfOperations,
        numOfErrors,
      );
      Sentry.captureException(
        new Error('Dropped usage reports that cannot be split below the Kafka size limit'),
      );
    },
    async sender(reports, estimatedSizeInBytes, batchId, validateSize) {
      const numOfOperations = reports.reduce((sum, report) => report.size + sum, 0);
      const compressLatencyStop = compressDuration.startTimer();
      const value = await compressZstd(JSON.stringify(reports)).finally(() => {
        compressLatencyStop();
      });
      estimationError.observe(Math.abs(estimatedSizeInBytes - value.byteLength) / value.byteLength);

      validateSize(value.byteLength); // this will throw if the size is too big

      try {
        bufferFlushes.inc();
        const stopTimer = kafkaDuration.startTimer();
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
          Sentry.setTags({
            batchId,
            errorCode: meta[0].errorCode,
            numOfOperations,
          });
          Sentry.captureException(new Error(`Failed to flush usage reports to Kafka`));
        } else {
          rawOperationWrites.inc(numOfOperations);
          logger.info(`Flushed (id=%s, operations=%s)`, batchId, numOfOperations);
        }
      } catch (error: any) {
        rawOperationFailures.inc(numOfOperations);

        changeStatus(Status.Unhealthy);
        logger.error(
          `Failed to flush. Adding to fallback queue (id=%s, error=%s)`,
          batchId,
          error.message,
        );
        fallback.add(value, numOfOperations);

        throw error;
      }
    },
  });

  const fallback = createFallbackQueue({
    async send(value, numOfOperations) {
      bufferFlushes.inc();
      const stopTimer = kafkaDuration.startTimer();
      try {
        await producer.send({
          topic: config.kafka.topic,
          compression: CompressionTypes.None,
          messages: [
            {
              value,
            },
          ],
        });
        rawOperationWrites.inc(numOfOperations);
      } catch (error) {
        rawOperationFailures.inc(numOfOperations);
        throw error;
      } finally {
        stopTimer();
      }

      if (fallback.size() === 0) {
        logger.info('Fallback queue flushed');
        changeStatus(Status.Ready);
      }
    },
    onTooLarge(numOfOperations) {
      // Already counted in rawOperationFailures when it entered the queue, so no
      // further metric change there; it stays counted, permanently, by simply never
      // being decremented.
      droppedOversizedOperations.inc(numOfOperations);
    },
    onQueueFull(numOfOperations) {
      // Distinct reason from onTooLarge: we're backlogged, not that this one payload
      // is too big. Also already counted in rawOperationFailures at entry; stays
      // counted by never being decremented.
      fallbackDroppedOperations.inc(numOfOperations);
    },
    logger: logger.child({ component: 'fallback' }),
  });

  let status: Status = Status.Waiting;
  function changeStatus(newStatus: Status) {
    if (status === newStatus) {
      return;
    }

    logger.info('Changing status to %s', newStatus);
    status = newStatus;
  }

  producer.on(producer.events.CONNECT, () => {
    logger.info(`Kafka producer: connected`);

    if (status === Status.Unhealthy) {
      changeStatus(Status.Ready);
    }
  });

  producer.on(producer.events.REQUEST_TIMEOUT, () => {
    logger.info('Kafka producer: request timeout');
  });

  producer.on(producer.events.DISCONNECT, () => {
    logger.info(`Kafka producer: disconnected`);
    if (status === Status.Ready) {
      changeStatus(Status.Unhealthy);
    }
  });

  async function stop() {
    logger.info('Started Usage shutdown...');

    changeStatus(Status.Stopped);
    await buffer.stop();
    logger.info(`Buffering stopped`);
    await fallback.stop();
    logger.info(`Fallback stopped`);
    await producer.disconnect();

    logger.info('Usage stopped');
  }

  return {
    collect: traceInlineSync(
      'collect',
      {
        initAttributes: report => ({
          'hive.service.ready': status == Status.Ready,
          'hive.input.report.id': report.id,
          'hive.input.report.size': Object.keys(report.map).length,
        }),
      },
      (report: RawReport) => {
        if (status !== Status.Ready) {
          throw new Error('Usage is not ready yet');
        }

        buffer.add(report);
      },
    ),
    readiness() {
      return status === Status.Ready;
    },
    async start() {
      logger.info('Starting Kafka producer');
      await producer.connect();
      buffer.start();
      changeStatus(Status.Ready);
      logger.info('Kafka producer is ready');
      fallback.start();
    },
    stop,
  };
}

export type Usage = ReturnType<typeof createUsage>;
