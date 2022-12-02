import './dev-polyfill';
import { createServer } from 'http';
import { createRequestHandler } from './handler';
import { createArtifactRequestHandler } from './artifact-handler';
import { devStorage } from './dev-polyfill';
import { createServerAdapter } from '@whatwg-node/server';
import { withParams, json } from 'itty-router-extras';
import { createIsKeyValid } from './key-validation';
import itty from 'itty-router';
import { S3Client } from '@aws-sdk/client-s3';
import { ArtifactStorageReader } from '@hive/api/src/modules/schema/providers/artifact-storage-reader';

// eslint-disable-next-line no-process-env
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4010;

/**
 * KV Storage for the CDN
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
declare let HIVE_DATA: KVNamespace;

/**
 * Secret used to sign the CDN keys
 */
declare let KEY_DATA: string;

const handleRequest = createRequestHandler({
  getRawStoreValue: value => HIVE_DATA.get(value),
  isKeyValid: createIsKeyValid({ keyData: KEY_DATA }),
});

declare let S3_ENDPOINT: string;
declare let S3_ACCESS_KEY_ID: string;
declare let S3_SECRET_ACCESS_KEY: string;
declare let S3_BUCKET_NAME: string;
declare let S3_PUBLIC_URL: string;

const s3Client = new S3Client({
  endpoint: S3_ENDPOINT,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  region: 'auto',
});

const artifactStorageReader = new ArtifactStorageReader(s3Client, S3_BUCKET_NAME, S3_PUBLIC_URL);

const handleArtifactRequest = createArtifactRequestHandler({
  isKeyValid: createIsKeyValid({ keyData: KEY_DATA }),
  async getArtifactUrl(targetId, artifactType) {
    return artifactStorageReader.generateArtifactReadUrl(targetId, artifactType);
  },
});

function main() {
  const app = createServerAdapter(itty.Router());

  app.put(
    '/:accountId/storage/kv/namespaces/:namespaceId/values/:key',
    withParams,
    async (
      request: Request & {
        params: {
          accountId: string;
          namespaceId: string;
          key: string;
        };
      },
    ) => {
      if (!request.params.key) {
        throw new Error(`Missing key`);
      }

      const textBody = await request.text();

      if (!textBody) {
        throw new Error(`Missing body value`);
      }

      console.log(`Writing to ephermal storage: ${request.params.key}, value: ${request.body}`);

      devStorage.set(request.params.key, textBody);

      return json({
        success: true,
      });
    },
  );

  app.get('/dump', () => json(Object.fromEntries(devStorage.entries())));

  app.get(
    '/_readiness',
    () =>
      new Response(null, {
        status: 200,
      }),
  );

  const router = itty
    .Router()
    .get('*', handleArtifactRequest)
    // Legacy CDN Handlers
    .get('*', handleRequest);

  app.get('*', (request: Request) => router.handle(request));

  const server = createServer(app);

  return new Promise<void>(resolve => {
    server.listen(PORT, '0.0.0.0', resolve);
  });
}

main().catch(e => console.error(e));
