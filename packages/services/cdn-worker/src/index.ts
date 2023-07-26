import itty from 'itty-router';
import { Toucan } from 'toucan-js';
import { AnalyticsEngine, createAnalytics } from './analytics';
import { createArtifactRequestHandler } from './artifact-handler';
import { ArtifactStorageReader } from './artifact-storage-reader';
import { AwsClient } from './aws';
import { UnexpectedError } from './errors';
import { createRequestHandler } from './handler';
import { createIsKeyValid } from './key-validation';

declare let S3_ENDPOINT: string;
declare let S3_ACCESS_KEY_ID: string;
declare let S3_SECRET_ACCESS_KEY: string;
declare let S3_SESSION_TOKEN: string;
declare let S3_BUCKET_NAME: string;

const s3 = {
  client: new AwsClient({
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    sessionToken: S3_SESSION_TOKEN,
    service: 's3',
  }),
  bucketName: S3_BUCKET_NAME,
  endpoint: S3_ENDPOINT,
};

const artifactStorageReader = new ArtifactStorageReader(s3, null);

/**
 * KV Storage for the CDN
 */
declare let HIVE_DATA: KVNamespace;

declare let SENTRY_DSN: string;
/**
 * Name of the environment, e.g. staging, production
 */
declare let SENTRY_ENVIRONMENT: string;
/**
 * Id of the release
 */
declare let SENTRY_RELEASE: string;

/**
 * Default cache on Cloudflare
 * See https://developers.cloudflare.com/workers/runtime-apis/cache/
 */
declare let caches: {
  default: Cache;
  open: (namespace: string) => Promise<Cache>;
};

declare let USAGE_ANALYTICS: AnalyticsEngine;
declare let ERROR_ANALYTICS: AnalyticsEngine;
declare let KEY_VALIDATION_ANALYTICS: AnalyticsEngine;

const analytics = createAnalytics({
  usage: USAGE_ANALYTICS,
  error: ERROR_ANALYTICS,
  keyValidation: KEY_VALIDATION_ANALYTICS,
});

self.addEventListener('fetch', async (event: FetchEvent) => {
  const isKeyValid = createIsKeyValid({
    waitUntil: p => event.waitUntil(p),
    getCache: () => caches.open('artifacts-auth'),
    s3,
    analytics,
  });

  const handleRequest = createRequestHandler({
    getRawStoreValue: value => HIVE_DATA.get(value),
    isKeyValid,
    analytics,
  });

  const handleArtifactRequest = createArtifactRequestHandler({
    isKeyValid,
    analytics,
    async getArtifactAction(targetId, artifactType, eTag) {
      return artifactStorageReader.generateArtifactReadUrl(targetId, artifactType, eTag);
    },
    async fallback(request: Request, params: { targetId: string; artifactType: string }) {
      const artifactTypeMap: Record<string, string> = {
        metadata: 'metadata',
        sdl: 'sdl',
        services: 'schema',
        supergraph: 'supergraph',
      };
      const artifactType = artifactTypeMap[params.artifactType];

      if (artifactType) {
        const url = request.url.replace(
          `/artifacts/v1/${params.targetId}/${params.artifactType}`,
          `/${params.targetId}/${artifactType}`,
        );

        return handleRequest(new Request(url, request));
      }

      return;
    },
  });

  const router = itty
    .Router()
    .get(
      '/_health',
      () =>
        new Response('OK', {
          status: 200,
        }),
    )
    .get('*', handleArtifactRequest)
    // Legacy CDN Handlers
    .get('*', handleRequest);

  const sentry = new Toucan({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    context: event,
    requestDataOptions: {
      allowedHeaders: [
        'user-agent',
        'cf-ipcountry',
        'accept-encoding',
        'accept',
        'x-real-ip',
        'cf-connecting-ip',
      ],
      allowedSearchParams: /(.*)/,
    },
  });

  try {
    event.respondWith(
      router
        .handle(event.request, sentry.captureException)
        .then(response => {
          if (response) {
            return response;
          }
          return new Response('Not found', { status: 404 });
        })
        .catch(err => {
          console.error(err);
          sentry.captureException(err);
          return new UnexpectedError(analytics);
        }),
    );
  } catch (error) {
    sentry.captureException(error);
    event.respondWith(new UnexpectedError(analytics));
  }
});
