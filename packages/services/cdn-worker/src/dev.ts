import { createServer } from 'http';
import { Response } from 'fets';
import zod from 'zod';
import { createArtifactRequestHandler } from './artifact-handler';
import { ArtifactStorageReader } from './artifact-storage-reader';
import { AwsClient } from './aws';
import './dev-polyfill';
import { devStorage } from './dev-polyfill';
import { createRequestHandler } from './handler';
import { createIsKeyValid } from './key-validation';

declare let S3_ENDPOINT: string;
declare let S3_ACCESS_KEY_ID: string;
declare let S3_SECRET_ACCESS_KEY: string;
declare let S3_BUCKET_NAME: string;
declare let S3_PUBLIC_URL: string;

const s3 = {
  client: new AwsClient({
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    service: 's3',
  }),
  bucketName: S3_BUCKET_NAME,
  endpoint: S3_ENDPOINT,
};

// eslint-disable-next-line no-process-env
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4010;

/**
 * KV Storage for the CDN
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
declare let HIVE_DATA: KVNamespace;

const handleRequest = createRequestHandler({
  getRawStoreValue: value => HIVE_DATA.get(value),
  isKeyValid: createIsKeyValid({ s3, getCache: null, waitUntil: null, analytics: null }),
});

const artifactStorageReader = new ArtifactStorageReader(s3, S3_PUBLIC_URL);

const handleArtifactRequest = createArtifactRequestHandler({
  isKeyValid: createIsKeyValid({ s3, getCache: null, waitUntil: null, analytics: null }),
  async getArtifactAction(targetId, artifactType, eTag) {
    return artifactStorageReader.generateArtifactReadUrl(targetId, artifactType, eTag);
  },
});

function main() {
  const app = handleArtifactRequest
    .route({
      method: 'GET',
      path: '/_readiness',
      handler: () =>
        new Response(null, {
          status: 200,
        }),
    })
    .route({
      path: '*',
      handler: handleRequest,
    })
    .route({
      method: 'PUT',
      path: '/:accountId/storage/kv/namespaces/:namespaceId/values/:key',
      schemas: {
        request: {
          params: zod.object({
            accountId: zod.string(),
            namespaceId: zod.string(),
            key: zod.string(),
          }),
        },
      },
      handler: async request => {
        const textBody = await request.text();

        if (!textBody) {
          throw new Error(`Missing body value`);
        }

        console.log(`Writing to ephermal storage: ${request.params.key}, value: ${textBody}`);

        devStorage.set(request.params.key, textBody);

        return Response.json({
          success: true,
        });
      },
    })
    .route({
      method: 'GET',
      path: '/dump',
      handler: () => Response.json(Object.fromEntries(devStorage.entries())),
    });

  const server = createServer(app);

  return new Promise<void>(resolve => {
    server.listen(PORT, '::', resolve);
  });
}

main().catch(e => console.error(e));
