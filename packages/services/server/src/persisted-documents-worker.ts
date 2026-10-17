import 'reflect-metadata';
import { parentPort } from 'node:worker_threads';
import { configureTracing } from '@hive/service-common';
import { createWorker } from '../../api/src/modules/app-deployments/worker/persisted-documents-worker';
import type { AwsCredentials } from '../../api/src/modules/cdn/providers/aws';
import { createDefaultCredentialProvider } from '../../api/src/modules/cdn/providers/aws';
import { createMessagePortLogger } from '../../api/src/modules/shared/providers/logger';
import { env } from './environment';

if (!parentPort) {
  throw new Error('This script must be run as a worker.');
}

// The OpenTelemetry registry is per thread, so the worker needs its own provider to export spans.
// Only the collector exporter: the Hive tracing processor drops spans whose root it did not see.
if (env.tracing.collectorEndpoint) {
  configureTracing({
    collectorEndpoint: env.tracing.collectorEndpoint,
    serviceName: 'graphql-api',
    enableConsoleExporter: env.tracing.enableConsoleExporter,
  }).setup();
}

const logger = createMessagePortLogger(parentPort);

function buildS3Config(
  label: string,
  s3: {
    bucketName: string;
    endpoint: string;
    awsIamAuthEnabled: boolean;
    credentials: {
      accessKeyId: string | undefined;
      secretAccessKey: string | undefined;
      sessionToken: string | undefined;
    };
  },
) {
  return {
    credentialProvider: createDefaultCredentialProvider({
      label,
      logger,
      staticCredentials:
        s3.credentials.accessKeyId && s3.credentials.secretAccessKey
          ? (s3.credentials as AwsCredentials)
          : undefined,
      awsIamAuthEnabled: s3.awsIamAuthEnabled,
    }),
    bucketName: s3.bucketName,
    endpoint: s3.endpoint,
  };
}

createWorker(parentPort, logger, {
  clickhouse: env.clickhouse,
  s3: buildS3Config('worker-s3', env.s3),
  s3Mirror: env.s3Mirror ? buildS3Config('worker-s3mirror', env.s3Mirror) : null,
});
