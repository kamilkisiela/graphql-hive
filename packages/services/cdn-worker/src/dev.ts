import { createServer } from 'http';
import itty from 'itty-router';
import { json, withParams } from 'itty-router-extras';
import { createServerAdapter } from '@whatwg-node/server';
import { createArtifactRequestHandler } from './artifact-handler';
import { ArtifactStorageReader } from './artifact-storage-reader';
import { AwsClient } from './aws';
import './dev-polyfill';
import { devStorage, env } from './dev-polyfill';
import { createRequestHandler } from './handler';
import { createIsKeyValid } from './key-validation';

const s3 = {
  client: new AwsClient({
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    service: 's3',
  }),
  bucketName: env.S3_BUCKET_NAME,
  endpoint: env.S3_ENDPOINT,
};

// eslint-disable-next-line no-process-env
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4010;

const handleRequest = createRequestHandler({
  getRawStoreValue: value => env.HIVE_DATA.get(value),
  isKeyValid: createIsKeyValid({ s3, getCache: null, waitUntil: null, analytics: null }),
});

const artifactStorageReader = new ArtifactStorageReader(s3, env.S3_PUBLIC_URL);

const handleArtifactRequest = createArtifactRequestHandler({
  isKeyValid: createIsKeyValid({ s3, getCache: null, waitUntil: null, analytics: null }),
  async getArtifactAction(targetId, artifactType, eTag) {
    return artifactStorageReader.generateArtifactReadUrl(targetId, artifactType, eTag);
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
    server.listen(PORT, '::', resolve);
  });
}

main().catch(e => console.error(e));
