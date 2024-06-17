import { type MessagePort } from 'node:worker_threads';
import { AwsClient } from '@hive/cdn-script/aws';
import { ClickHouse } from '../../operations/providers/clickhouse-client';
import { HttpClient } from '../../shared/providers/http-client';
import { Logger } from '../../shared/providers/logger';
import { S3Config } from '../../shared/providers/s3-config';
import {
  BatchProcessedEvent,
  PersistedDocumentIngester,
  type BatchProcessEvent,
} from '../providers/persisted-document-ingester';

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
      readonly credentials: {
        readonly accessKeyId: string;
        readonly secretAccessKey: string;
        readonly sessionToken: string | undefined;
      };
    };
    clickhouse: {
      readonly host: string;
      readonly port: number;
      readonly protocol?: string;
      readonly username?: string;
      readonly password?: string;
    };
  },
) {
  const s3Config: S3Config = {
    client: new AwsClient({
      accessKeyId: env.s3.credentials.accessKeyId,
      secretAccessKey: env.s3.credentials.secretAccessKey,
      sessionToken: env.s3.credentials.sessionToken,
      service: 's3',
    }),
    bucket: env.s3.bucketName,
    endpoint: env.s3.endpoint,
  };

  const logger = baseLogger.child({
    source: 'PersistedDocumentsWorker',
  });

  const clickhouse = new ClickHouse(env.clickhouse, new HttpClient(), logger);

  const persistedOperationsProcessor = new PersistedDocumentIngester(
    clickhouse,
    s3Config,
    logger as any,
  );

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

  port.on('message', async (message: BatchProcessEvent) => {
    logger.debug('processing message', message.id, message.event);
    const result = await persistedOperationsProcessor.processBatch(message.data);
    logger.debug('send message result', message.id, message.event);
    port.postMessage({
      event: 'processedBatch',
      id: message.id,
      data: result,
    } satisfies BatchProcessedEvent);
  });

  process.on('exit', function (code) {
    console.log('exit', code);
  });
}
