import { S3Client, ListObjectsCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { fetch } from '@whatwg-node/fetch';

const s3Client = new S3Client({
  endpoint: 'http://127.0.0.1:9000',
  region: 'auto',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
  forcePathStyle: true,
});

async function deleteAllS3BucketObjects(s3Client: S3Client, bucketName: string) {
  const listObjectsCommand = new ListObjectsCommand({
    Bucket: bucketName,
  });
  const result = await s3Client.send(listObjectsCommand);
  const keysToDelete: Array<{ Key: string }> = [];

  if (result.Contents) {
    for (const item of result.Contents) {
      if (item.Key) {
        keysToDelete.push({ Key: item.Key });
      }
    }
  }

  if (keysToDelete.length) {
    const deleteObjectsCommand = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: { Objects: keysToDelete },
    });

    await s3Client.send(deleteObjectsCommand);
  }
}

beforeEach(async () => {
  await deleteAllS3BucketObjects(s3Client, 'artifacts');
});

function buildEndpointUrl(
  baseUrl: string,
  targetId: string,
  resourceType: 'sdl' | 'supergraph' | 'services' | 'metadata',
) {
  return `${baseUrl}${targetId}/${resourceType}`;
}

/**
 * We have both a CDN that runs as part of the server and one that runs as a standalone service (cloudflare worker).
 */
function runArtifactsCDNTests(name: string, endpointBaseUrl: string) {
  describe(`Artifacts CDN ${name}`, () => {
    test('access without credentials', async () => {
      const url = buildEndpointUrl(endpointBaseUrl, 'i-do-not-exist', 'sdl');
      const response = await fetch(url, { method: 'GET' });
      expect(response.status).toEqual(400);
      expect(await response.text()).toEqual({
        code: 'MISSING_AUTH_KEY',
        error: 'Hive CDN authentication key is missing',
        description:
          'Please refer to the documentation for more details: https://docs.graphql-hive.com/features/registry-usage',
      });
      expect(response.headers.get('location')).toEqual(null);
    });

    test('access invalid credentials', async () => {
      const url = buildEndpointUrl(endpointBaseUrl, 'i-do-not-exist', 'sdl');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': 'skrrtbrrrt',
        },
      });
      expect(response.status).toEqual(403);
      expect(await response.text()).toEqual({
        code: 'INVALID_AUTH_KEY',
        error:
          'Hive CDN authentication key is invalid, or it does not match the requested target ID.',
        description:
          'Please refer to the documentation for more details: https://docs.graphql-hive.com/features/registry-usage',
      });
      expect(response.headers.get('location')).toEqual(null);
    });
  });
}

runArtifactsCDNTests('API Mirror', 'http://127.0.0.1:3001/artifacts/v1/');
