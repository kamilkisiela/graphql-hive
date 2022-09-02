import { Kafka, CompressionTypes, logLevel, Partitioners } from 'kafkajs';
import { createHash, randomUUID } from 'crypto';
import { compress } from '@hive/usage-common';
import {
  rawOperationWrites,
  rawOperationFailures,
  rawOperationsSize,
  invalidRawOperations,
  totalOperations,
  totalReports,
  totalLegacyReports,
  kafkaLatency,
  compressLatency,
  bufferFlushes,
  estimationError,
} from './metrics';
import { createKVBuffer, calculateChunkSize, isBufferTooBigError } from './buffer';
import { validateOperation, validateOperationMapRecord } from './validation';
import type { FastifyLoggerInstance } from '@hive/service-common';
import type { RawReport, RawOperationMap } from '@hive/usage-common';
import type { IncomingReport, IncomingLegacyReport } from './types';
import type { TokensResponse } from './tokens';

const DAY_IN_MS = 86_400_000;

enum Status {
  Waiting,
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
  logger: FastifyLoggerInstance;
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
}) {
  const { logger } = config;

  const kafka = new Kafka({
    clientId: 'usage',
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
    // settings recommended by Azure EventHub https://docs.microsoft.com/en-us/azure/event-hubs/apache-kafka-configurations
    requestTimeout: 60_000, //
    connectionTimeout: 5000,
    authenticationTimeout: 5000,
  });
  const producer = kafka.producer({
    idempotent: true,
    // settings recommended by Azure EventHub https://docs.microsoft.com/en-us/azure/event-hubs/apache-kafka-configurations
    metadataMaxAge: 180_000,
    createPartitioner: Partitioners.LegacyPartitioner,
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
        const compressLatencyStop = compressLatency.startTimer();
        const value = await compress(JSON.stringify(reports)).finally(() => {
          compressLatencyStop();
        });
        const stopTimer = kafkaLatency.startTimer();

        estimationError.observe(Math.abs(estimatedSizeInBytes - value.byteLength) / value.byteLength);

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
      } catch (error: any) {
        rawOperationFailures.inc(numOfOperations);

        if (isBufferTooBigError(error)) {
          logger.debug('Buffer too big, retrying (id=%s, error=%s)', batchId, error.message);
        } else {
          logger.error(`Failed to flush (id=%s, error=%s)`, batchId, error.message);
        }

        throw error;
      }
    },
  });

  let status: Status = Status.Waiting;

  return {
    async collect(
      incomingReport: IncomingReport | IncomingLegacyReport,
      token: TokensResponse,
      targetRetentionInDays: number | null
    ) {
      if (status !== Status.Ready) {
        throw new Error('Usage is not ready yet');
      }

      const now = Date.now();

      const incoming = ensureReportFormat(incomingReport);

      const size = incoming.operations.length;
      totalReports.inc();
      totalOperations.inc(size);
      rawOperationsSize.observe(size);

      let invalidOperationSize = 0;

      const outgoing: RawReport = {
        id: randomUUID(),
        target: token.target,
        size: 0,
        map: {},
        operations: [],
      };

      for (const key in incoming.map) {
        const record = incoming.map[key];
        const validationResult = validateOperationMapRecord(record);

        if (validationResult.valid) {
          outgoing.map[key] = {
            key,
            operation: record.operation,
            operationName: record.operationName,
            fields: record.fields,
          };
        }
      }

      for (const operation of incoming.operations) {
        const validationResult = validateOperation(operation, outgoing.map);

        if (validationResult.valid) {
          // Increase size
          outgoing.size += 1;

          // Add operation
          const ts = operation.timestamp ?? now;
          outgoing.operations.push({
            operationMapKey: operation.operationMapKey,
            timestamp: ts,
            expiresAt: targetRetentionInDays ? ts + targetRetentionInDays * DAY_IN_MS : undefined,
            execution: {
              ok: operation.execution.ok,
              duration: operation.execution.duration,
              errorsTotal: operation.execution.errorsTotal,
            },
            metadata: {
              client: {
                name: operation.metadata?.client?.name,
                version: operation.metadata?.client?.version,
              },
            },
          });
        } else {
          logger.warn(`Detected invalid operation (target=%s): %o`, token.target, validationResult.errors);
          invalidOperationSize += 1;
        }
      }

      invalidRawOperations.inc(invalidOperationSize);

      buffer.add(outgoing);
      return {
        size: outgoing.size,
        id: outgoing.id,
      };
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
    async stop() {
      logger.info('Started Usage shutdown...');

      status = Status.Stopped;
      await buffer.stop();
      logger.info(`Buffering stopped`);
      await producer.disconnect();
      logger.info(`Producer disconnected`);

      logger.info('Usage stopped');
    },
  };
}

function isLegacyReport(report: IncomingReport | IncomingLegacyReport): report is IncomingLegacyReport {
  return Array.isArray(report);
}

function ensureReportFormat(report: IncomingLegacyReport | IncomingReport): IncomingReport {
  if (isLegacyReport(report)) {
    totalLegacyReports.inc();
    return convertLegacyReport(report);
  }

  return report;
}

function convertLegacyReport(legacy: IncomingLegacyReport): IncomingReport {
  const hashMap = new Map<string, string>();
  const report: IncomingReport = {
    map: {},
    operations: [],
  };

  for (const op of legacy) {
    let operationMapKey = hashMap.get(op.operation);

    if (!operationMapKey) {
      operationMapKey = createHash('sha256').update(op.operation).update(JSON.stringify(op.fields)).digest('hex');
      report.map[operationMapKey] = {
        operation: op.operation,
        operationName: op.operationName,
        fields: op.fields,
      };
    }

    report.operations.push({
      operationMapKey,
      timestamp: op.timestamp,
      execution: {
        ok: op.execution.ok,
        duration: op.execution.duration,
        errorsTotal: op.execution.errorsTotal,
      },
      metadata: {
        client: {
          name: op.metadata?.client?.name,
          version: op.metadata?.client?.version,
        },
      },
    });
  }

  return report;
}
