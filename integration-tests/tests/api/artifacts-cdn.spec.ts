import { ProjectType, TargetAccessScope } from '@app/gql/graphql';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { fetch } from '@whatwg-node/fetch';
import { initSeed } from '../../testkit/seed';
import { getServiceHost } from '../../testkit/utils';

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

async function fetchS3ObjectArtifact(
  bucketName: string,
  key: string,
): Promise<{ body: string; eTag: string }> {
  const getObjectCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });
  const result = await s3Client.send(getObjectCommand);
  return {
    body: await result.Body!.transformToString(),
    eTag: result.ETag!,
  };
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
function runArtifactsCDNTests(
  name: string,
  runtime: { service: string; port: number; path: string },
) {
  const getBaseEndpoint = () =>
    getServiceHost(runtime.service, runtime.port).then(v => `http://${v}${runtime.path}`);
  describe(`Artifacts CDN ${name}`, () => {
    test.concurrent('access without credentials', async () => {
      const endpointBaseUrl = await getBaseEndpoint();
      const url = buildEndpointUrl(endpointBaseUrl, 'i-do-not-exist', 'sdl');
      const response = await fetch(url, { method: 'GET' });
      expect(response.status).toEqual(400);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.json()).toEqual({
        code: 'MISSING_AUTH_KEY',
        error: 'Hive CDN authentication key is missing',
        description:
          'Please refer to the documentation for more details: https://docs.graphql-hive.com/features/registry-usage',
      });
      expect(response.headers.get('location')).toEqual(null);
    });

    test.concurrent('access invalid credentials', async () => {
      const endpointBaseUrl = await getBaseEndpoint();
      const url = buildEndpointUrl(endpointBaseUrl, 'i-do-not-exist', 'sdl');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': 'skrrtbrrrt',
        },
      });
      expect(response.status).toEqual(403);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.json()).toEqual({
        code: 'INVALID_AUTH_KEY',
        error:
          'Hive CDN authentication key is invalid, or it does not match the requested target ID.',
        description:
          'Please refer to the documentation for more details: https://docs.graphql-hive.com/features/registry-usage',
      });
      expect(response.headers.get('location')).toEqual(null);
    });

    test.concurrent('access SDL artifact with valid credentials', async () => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createToken, target } = await createProject(ProjectType.Single);
      const writeToken = await createToken({
        targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      });

      // Publish Schema
      const publishSchemaResult = await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(publishSchemaResult.schemaPublish.__typename).toEqual('SchemaPublishSuccess');
      const cdnAccessResult = await writeToken.createCdnAccess();
      const endpointBaseUrl = await getBaseEndpoint();
      const url = buildEndpointUrl(endpointBaseUrl, target!.id, 'sdl');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.token,
        },
        redirect: 'manual',
      });

      expect(response.status).toMatchInlineSnapshot(`302`);
      expect(await response.text()).toMatchInlineSnapshot(`"Found."`);
      expect(response.headers.get('location')).toBeDefined();

      const artifactContents = await fetchS3ObjectArtifact(
        'artifacts',
        `artifact/${target!.id}/sdl`,
      );
      expect(artifactContents.body).toMatchInlineSnapshot(`
        "type Query {
          ping: String
        }"
      `);
    });

    test.concurrent('access services artifact with valid credentials', async () => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createToken, target } = await createProject(ProjectType.Federation);
      const writeToken = await createToken({
        targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      });

      // Publish Schema
      const publishSchemaResult = await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
          service: 'ping',
          url: 'ping.com',
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(publishSchemaResult.schemaPublish.__typename).toEqual('SchemaPublishSuccess');

      // check if artifact exists in bucket
      const artifactContents = await fetchS3ObjectArtifact(
        'artifacts',
        `artifact/${target!.id}/services`,
      );
      expect(artifactContents.body).toMatchInlineSnapshot(
        `"[{"name":"ping","sdl":"type Query { ping: String }","url":"ping.com"}]"`,
      );

      const cdnAccessResult = await writeToken.createCdnAccess();
      const endpointBaseUrl = await getBaseEndpoint();
      const url = buildEndpointUrl(endpointBaseUrl, target!.id, 'services');
      let response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.token,
        },
        redirect: 'manual',
      });

      expect(response.status).toMatchInlineSnapshot(`302`);
      expect(await response.text()).toMatchInlineSnapshot(`"Found."`);
      const locationHeader = response.headers.get('location');
      expect(locationHeader).toBeDefined();
      const locationUrl = new URL(locationHeader!);
      expect(locationUrl.protocol).toEqual('http:');
      expect(locationUrl.hostname).toEqual('localhost');
      expect(locationUrl.port).toEqual('8083');

      response = await fetch(locationHeader!, {
        method: 'GET',
        redirect: 'manual',
      });
      const body = await response.text();
      expect(response.status).toEqual(200);
      expect(body).toMatchInlineSnapshot(
        `"[{"name":"ping","sdl":"type Query { ping: String }","url":"ping.com"}]"`,
      );
    });

    test.concurrent('access services artifact with if-none-match header', async () => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createToken, target } = await createProject(ProjectType.Federation);
      const writeToken = await createToken({
        targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      });

      // Publish Schema

      const publishSchemaResult = await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
          service: 'ping',
          url: 'ping.com',
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(publishSchemaResult.schemaPublish.__typename).toEqual('SchemaPublishSuccess');

      // check if artifact exists in bucket
      const artifactContents = await fetchS3ObjectArtifact(
        'artifacts',
        `artifact/${target!.id}/services`,
      );
      expect(artifactContents.body).toMatchInlineSnapshot(
        `"[{"name":"ping","sdl":"type Query { ping: String }","url":"ping.com"}]"`,
      );

      const cdnAccessResult = await writeToken.createCdnAccess();
      const endpointBaseUrl = await getBaseEndpoint();
      const url = buildEndpointUrl(endpointBaseUrl, target!.id, 'services');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.token,
          'if-none-match': artifactContents.eTag,
        },
        redirect: 'manual',
      });

      expect(response.status).toMatchInlineSnapshot(`304`);
    });
  });
}

runArtifactsCDNTests('API Mirror', { service: 'server', port: 8082, path: '/artifacts/v1/' });
// runArtifactsCDNTests('Local CDN Mock', 'http://127.0.0.1:3004/artifacts/v1/');
