import { createServer } from 'http';
import * as itty from 'itty-router';
import { createServerAdapter } from '@whatwg-node/server';
import { createArtifactRequestHandler } from './artifact-handler';
import { ArtifactStorageReader } from './artifact-storage-reader';
import { AwsClient } from './aws';
import './dev-polyfill';
import { env } from './dev-polyfill';
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

const artifactStorageReader = new ArtifactStorageReader(s3, env.S3_PUBLIC_URL, null);

const handleRequest = createRequestHandler({
  isKeyValid: createIsKeyValid({ s3, getCache: null, waitUntil: null, analytics: null }),
  async getArtifactAction(targetId, contractName, artifactType, eTag) {
    return artifactStorageReader.generateArtifactReadUrl(
      targetId,
      contractName,
      artifactType,
      eTag,
    );
  },
  async fetchText(url) {
    const r = await fetch(url);

    if (r.ok) {
      return r.text();
    }

    throw new Error(`Failed to fetch ${url}, status: ${r.status}`);
  },
});

const handleArtifactRequest = createArtifactRequestHandler({
  isKeyValid: createIsKeyValid({ s3, getCache: null, waitUntil: null, analytics: null }),
  async getArtifactAction(targetId, contractName, artifactType, eTag) {
    return artifactStorageReader.generateArtifactReadUrl(
      targetId,
      contractName,
      artifactType,
      eTag,
    );
  },
});

function main() {
  const app = createServerAdapter(itty.Router());

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
