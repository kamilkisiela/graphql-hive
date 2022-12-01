import Toucan from 'toucan-js';
import itty from 'itty-router';
import { ArtifactStorageReader } from '@hive/api/src/modules/schema/providers/artifact-storage-reader';
import { S3Client } from '@aws-sdk/client-s3';
import { createIsKeyValid } from './key-validation';
import { UnexpectedError } from './errors';
import { createRequestHandler } from './handler';
import { createArtifactRequestHandler } from './artifact-handler';

/**
 * KV Storage for the CDN
 */
declare let HIVE_DATA: KVNamespace;

/**
 * Secret used to sign the CDN keys
 */
declare let KEY_DATA: string;

declare let SENTRY_DSN: string;
/**
 * Name of the environment, e.g. staging, production
 */
declare let SENTRY_ENVIRONMENT: string;
/**
 * Id of the release
 */
declare let SENTRY_RELEASE: string;

const isKeyValid = createIsKeyValid({ keyData: KEY_DATA });

const handleRequest = createRequestHandler({
  getRawStoreValue: value => HIVE_DATA.get(value),
  isKeyValid,
});

declare let S3_ENDPOINT: string;
declare let S3_ACCESS_KEY_ID: string;
declare let S3_SECRET_ACCESS_KEY: string;
declare let S3_BUCKET_NAME: string;

const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  region: 'auto',
});

const artifactStorageReader = new ArtifactStorageReader(s3Client, S3_BUCKET_NAME, null);

const handleArtifactRequest = createArtifactRequestHandler({
  isKeyValid,
  async getArtifactUrl(targetId, artifactType) {
    return artifactStorageReader.generateArtifactReadUrl(targetId, artifactType);
  },
});

const router = itty
  .Router()
  .get('*', handleArtifactRequest)
  // Legacy CDN Handlers
  .get('*', handleRequest);

self.addEventListener('fetch', async (event: FetchEvent) => {
  const sentry = new Toucan({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    context: event,
    allowedHeaders: [
      'user-agent',
      'cf-ipcountry',
      'accept-encoding',
      'accept',
      'x-real-ip',
      'cf-connecting-ip',
    ],
    allowedSearchParams: /(.*)/,
  });

  try {
    event.respondWith(
      router
        .handle(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          return new Response('Not found', { status: 404 });
        })
        .catch(err => {
          console.error(err);
          sentry.captureException(err);
          return new UnexpectedError();
        }),
    );
  } catch (error) {
    sentry.captureException(error);
    event.respondWith(new UnexpectedError());
  }
});
