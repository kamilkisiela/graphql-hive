import * as itty from 'itty-router';
import { Toucan } from 'toucan-js';
import { AnalyticsEngine, createAnalytics } from './analytics';
import { createArtifactRequestHandler } from './artifact-handler';
import { ArtifactStorageReader } from './artifact-storage-reader';
import { AwsClient } from './aws';
import { UnexpectedError } from './errors';
import { createRequestHandler } from './handler';
import { createIsAppDeploymentActive } from './is-app-deployment-active';
import { createIsKeyValid } from './key-validation';
import { createResponse } from './tracked-response';

type Env = {
  S3_ENDPOINT: string;
  S3_ACCESS_KEY_ID: string;
  S3_SECRET_ACCESS_KEY: string;
  S3_BUCKET_NAME: string;
  S3_SESSION_TOKEN?: string;

  S3_MIRROR_ENDPOINT: string;
  S3_MIRROR_ACCESS_KEY_ID: string;
  S3_MIRROR_SECRET_ACCESS_KEY: string;
  S3_MIRROR_BUCKET_NAME: string;
  S3_MIRROR_SESSION_TOKEN?: string;

  SENTRY_DSN: string;
  /**
   * Name of the environment, e.g. staging, production
   */
  SENTRY_ENVIRONMENT: string;
  /**
   * Id of the release
   */
  SENTRY_RELEASE: string;
  /**
   * Worker's Analytics Engines
   */
  USAGE_ANALYTICS: AnalyticsEngine;
  ERROR_ANALYTICS: AnalyticsEngine;
  RESPONSE_ANALYTICS: AnalyticsEngine;
  R2_ANALYTICS: AnalyticsEngine;
  S3_ANALYTICS: AnalyticsEngine;
  KEY_VALIDATION_ANALYTICS: AnalyticsEngine;
};

const handler: ExportedHandler<Env> = {
  async fetch(request: Request, env, ctx) {
    const s3 = {
      client: new AwsClient({
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        sessionToken: env.S3_SESSION_TOKEN,
        service: 's3',
      }),
      bucketName: env.S3_BUCKET_NAME,
      endpoint: env.S3_ENDPOINT,
    };

    const s3Mirror = {
      client: new AwsClient({
        accessKeyId: env.S3_MIRROR_ACCESS_KEY_ID,
        secretAccessKey: env.S3_MIRROR_SECRET_ACCESS_KEY,
        sessionToken: env.S3_MIRROR_SESSION_TOKEN,
        service: 's3',
      }),
      bucketName: env.S3_MIRROR_BUCKET_NAME,
      endpoint: env.S3_MIRROR_ENDPOINT,
    };

    const analytics = createAnalytics({
      usage: env.USAGE_ANALYTICS,
      error: env.ERROR_ANALYTICS,
      keyValidation: env.KEY_VALIDATION_ANALYTICS,
      response: env.RESPONSE_ANALYTICS,
      r2: env.R2_ANALYTICS,
      s3: env.S3_ANALYTICS,
    });

    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      environment: env.SENTRY_ENVIRONMENT,
      release: env.SENTRY_RELEASE,
      dist: 'cdn-worker',
      context: ctx,
      request,
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

    const artifactStorageReader = new ArtifactStorageReader(
      s3,
      s3Mirror,
      analytics,
      (message: string) => sentry.addBreadcrumb({ message }),
    );

    const isKeyValid = createIsKeyValid({
      waitUntil: p => ctx.waitUntil(p),
      getCache: () => caches.open('artifacts-auth'),
      artifactStorageReader,
      analytics,
      breadcrumb(message: string) {
        sentry.addBreadcrumb({
          message,
        });
      },
      captureException(error) {
        sentry.captureException(error);
      },
    });

    const handleRequest = createRequestHandler({
      async getArtifactAction(targetId, contractName, artifactType, eTag) {
        return artifactStorageReader.readArtifact(targetId, contractName, artifactType, eTag);
      },
      isKeyValid,
      breadcrumb(message: string) {
        sentry.addBreadcrumb({
          message,
        });
      },
      analytics,
      async fetchText(url) {
        // Yeah, it's not globally defined, but it makes no sense to define it globally
        // it's only used here and it's easier to see how it's used
        const retries = 5;
        const initRetryMs = 50;

        for (let i = 0; i <= retries; i++) {
          const fetched = fetch(url, {
            signal: AbortSignal.timeout(2_000),
          });

          if (i === retries) {
            const res = await fetched;
            if (res.ok) {
              return res.text();
            }

            throw new Error(`Failed to fetch ${url}, status: ${res.status}`);
          }

          try {
            const res = await fetched;
            if (res.ok) {
              return res.text();
            }
          } catch (error) {
            // Retry also when there's an exception
            console.warn(error);
          }
          await new Promise(resolve =>
            setTimeout(resolve, Math.random() * initRetryMs * Math.pow(2, i)),
          );
        }

        throw new Error('An unknown error occurred, ensure retries is not negative');
      },
    });

    const cache = await caches.open('cdn-responses');

    const handleArtifactRequest = createArtifactRequestHandler({
      isKeyValid,
      analytics,
      breadcrumb(message: string) {
        sentry.addBreadcrumb({ message });
      },
      artifactStorageReader,
      isAppDeploymentActive: createIsAppDeploymentActive({
        artifactStorageReader,
        getCache: () => caches.open('artifacts-auth'),
        waitUntil: p => ctx.waitUntil(p),
      }),
      requestCache: {
        get(request) {
          const cacheKey = new Request(request.url.toString(), request);
          return cache.match(cacheKey);
        },
        set(request, response) {
          ctx.waitUntil(cache.put(request, response.clone()));
        },
      },
    });

    const { corsify, preflight } = itty.createCors();

    const router = itty
      .Router()
      // Handles all OPTIONS and preflight requests.
      // https://github.com/kwhitley/itty.dev/blob/v4.x/src/routes/itty-router/cors/%2Bpage.md#preflight-middleware
      .all('*', preflight)
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

    return (
      router
        .handle(request, sentry.captureException.bind(sentry))
        .then(response => {
          if (response) {
            return response;
          }

          sentry.addBreadcrumb({
            message: 'No response from router',
          });

          return createResponse(analytics, 'Not found', { status: 404 }, 'unknown', request);
        })
        .catch(error => {
          console.error(error);
          sentry.captureException(error);
          return new UnexpectedError(analytics, request);
        })
        // Adds the appropriate CORS headers to any Response.
        // https://github.com/kwhitley/itty.dev/blob/v4.x/src/routes/itty-router/cors/%2Bpage.md#corsify
        .then(corsify)
    );
  },
};

export default handler;
