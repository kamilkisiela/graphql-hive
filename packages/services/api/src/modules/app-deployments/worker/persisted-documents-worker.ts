import { type MessagePort } from 'node:worker_threads';
import { setErrorSource } from '@hive/service-common';
import { AwsClient } from '../../cdn/providers/aws';
import type { S3CredentialProvider } from '../../cdn/providers/aws';
import { ClickHouse } from '../../operations/providers/clickhouse-client';
import type { ClickHouseConfig } from '../../operations/providers/tokens';
import { HttpClient } from '../../shared/providers/http-client';
import { Logger } from '../../shared/providers/logger';
import { S3Config } from '../../shared/providers/s3-config';
import { S3Writer, summarizeR2ErrorTraces } from '../../shared/providers/s3-writer';
import type { R2ErrorTrace, S3WriteMetric } from '../../shared/providers/s3-writer';
import {
  PersistedDocumentIngester,
  type BatchCancelEvent,
  type BatchProcessedEvent,
  type BatchProcessEvent,
  type BatchProcessingErrorEvent,
} from '../providers/persisted-document-ingester';
import { serializeWorkerError } from '../providers/persisted-document-scheduler';

/**
 * Create a worker for processing incoming persisted operations.
 * Because we don't want to block the main thread on the API
 */
export function createWorker(
  port: MessagePort,
  baseLogger: Logger,
  env: {
    s3: {
      readonly bucketName: string;
      readonly endpoint: string;
      readonly credentialProvider: S3CredentialProvider;
    };
    s3Mirror: {
      readonly bucketName: string;
      readonly endpoint: string;
      readonly credentialProvider: S3CredentialProvider;
    } | null;
    clickhouse: ClickHouseConfig;
  },
) {
  const s3Config = new S3Config([
    {
      client: new AwsClient({
        credentialProvider: env.s3.credentialProvider,
        service: 's3',
      }),
      bucket: env.s3.bucketName,
      endpoint: env.s3.endpoint,
    },
    ...(env.s3Mirror
      ? [
          {
            client: new AwsClient({
              credentialProvider: env.s3Mirror.credentialProvider,
              service: 's3',
            }),
            bucket: env.s3Mirror.bucketName,
            endpoint: env.s3Mirror.endpoint,
          },
        ]
      : []),
  ]);

  const logger = baseLogger.child({
    source: 'PersistedDocumentsWorker',
  });

  const clickhouse = new ClickHouse(env.clickhouse, new HttpClient(), logger);

  process.on('unhandledRejection', function (err) {
    console.error('unhandledRejection', err);
    console.error(err);
    port.postMessage({
      code: 'ERROR',
      err,
    });
    process.exit(1);
  });

  process.on('uncaughtException', function (err) {
    console.error('uncaughtException', err);
    port.postMessage({
      code: 'ERROR',
      err,
    });
    process.exit(1);
  });

  const controllers = new Map<string, AbortController>();

  port.on('message', async (message: BatchProcessEvent | BatchCancelEvent) => {
    if (message.event === 'CANCEL') {
      controllers
        .get(message.id)
        ?.abort(setErrorSource(new Error(message.reason), 'persisted-documents-worker'));
      return;
    }

    logger.debug('processing message', message.id, message.event);
    const controller = new AbortController();
    controllers.set(message.id, controller);
    const s3WriteMetrics: Array<S3WriteMetric> = [];
    const r2ErrorTraces: Array<R2ErrorTrace> = [];
    const persistedOperationsProcessor = new PersistedDocumentIngester(
      clickhouse,
      new S3Writer(
        s3Config,
        metric => s3WriteMetrics.push(metric),
        errors => r2ErrorTraces.push(...errors),
      ),
      logger as any,
    );
    try {
      const result = await persistedOperationsProcessor.processBatch(
        message.data,
        controller.signal,
      );
      logger.debug('send message result', message.id, message.event);
      port.postMessage({
        event: 'processedBatch',
        id: message.id,
        data: result,
        s3WriteMetrics,
        r2ErrorTraceSummary: summarizeR2ErrorTraces(r2ErrorTraces),
      } satisfies BatchProcessedEvent);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        logger.info(
          'batch cancelled by the scheduler (messageId=%s, reason=%s)',
          message.id,
          String(controller.signal.reason),
        );
      } else {
        logger.error(
          'unexpected error while processing message in worker (messageId=%s)',
          message.id,
        );
        logger.error(String(err));
      }
      port.postMessage({
        event: 'error',
        id: message.id,
        error: serializeWorkerError(err),
        s3WriteMetrics,
        r2ErrorTraceSummary: summarizeR2ErrorTraces(r2ErrorTraces),
      } satisfies BatchProcessingErrorEvent);
    } finally {
      controllers.delete(message.id);
    }
  });

  process.on('exit', function (code) {
    console.log('exit', code);
  });
}
