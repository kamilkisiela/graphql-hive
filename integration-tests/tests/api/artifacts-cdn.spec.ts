import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { ProjectType } from 'testkit/gql/graphql';
import { ApolloGateway } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createSupergraphManager } from '@graphql-hive/apollo';
import { graphql } from '../../testkit/gql';
import { execute } from '../../testkit/graphql';
import { initSeed } from '../../testkit/seed';
import { getServiceHost, KnownServices } from '../../testkit/utils';

const s3Client = new S3Client({
  endpoint: 'http://127.0.0.1:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
  forcePathStyle: true,
});

async function deleteS3Object(s3Client: S3Client, bucketName: string, keysToDelete: Array<string>) {
  if (keysToDelete.length) {
    const deleteObjectsCommand = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: { Objects: keysToDelete.map(key => ({ Key: key })) },
    });

    await s3Client.send(deleteObjectsCommand);
  }
}

async function putS3Object(s3Client: S3Client, bucketName: string, key: string, body: string) {
  const putObjectCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
  });
  await s3Client.send(putObjectCommand);
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

function buildEndpointUrl(
  baseUrl: string,
  targetId: string,
  resourceType: 'sdl' | 'supergraph' | 'services' | 'metadata',
) {
  return `${baseUrl}${targetId}/${resourceType}`;
}

function buildVersionedEndpointUrl(
  baseUrl: string,
  targetId: string,
  versionId: string,
  resourceType: 'sdl' | 'supergraph' | 'services' | 'metadata',
) {
  return `${baseUrl}${targetId}/version/${versionId}/${resourceType}`;
}

function buildVersionedContractEndpointUrl(
  baseUrl: string,
  targetId: string,
  versionId: string,
  contractName: string,
  resourceType: 'sdl' | 'supergraph',
) {
  return `${baseUrl}${targetId}/version/${versionId}/contracts/${contractName}/${resourceType}`;
}

const CreateContractMutation = graphql(`
  mutation CreateContractMutationCDN($input: CreateContractInput!) {
    createContract(input: $input) {
      ok {
        createdContract {
          id
        }
      }
      error {
        message
      }
    }
  }
`);

function generateLegacyToken(targetId: string) {
  const encoder = new TextEncoder();
  return (
    crypto
      // eslint-disable-next-line no-process-env
      .createHmac('sha256', process.env.HIVE_ENCRYPTION_SECRET!)
      .update(encoder.encode(targetId))
      .digest('base64')
  );
}

/**
 * We have both a CDN that runs as part of the server and one that runs as a standalone service (cloudflare worker).
 */
function runArtifactsCDNTests(
  name: string,
  runtime: { service: KnownServices; port: number; path: string },
) {
  const getBaseEndpoint = () =>
    getServiceHost(runtime.service, runtime.port).then(v => `http://${v}${runtime.path}`);

  describe(`Artifacts CDN ${name}`, () => {
    test.concurrent(
      'legacy cdn access key can be used for accessing artifacts',
      async ({ expect }) => {
        const endpointBaseUrl = await getBaseEndpoint();
        const { createOrg } = await initSeed().createOwner();
        const { createProject } = await createOrg();
        const { target, createTargetAccessToken } = await createProject(ProjectType.Single);
        const token = await createTargetAccessToken({});

        await token
          .publishSchema({
            author: 'Kamil',
            commit: 'abc123',
            sdl: `type Query { ping: String }`,
          })
          .then(r => r.expectNoGraphQLErrors());

        // manually generate CDN access token for legacy support
        const legacyToken = generateLegacyToken(target.id);
        const legacyTokenHash = await bcrypt.hash(legacyToken, await bcrypt.genSalt(10));
        await putS3Object(s3Client, 'artifacts', `cdn-legacy-keys/${target.id}`, legacyTokenHash);

        const url = buildEndpointUrl(endpointBaseUrl, target.id, 'sdl');
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'x-hive-cdn-key': legacyToken,
          },
        });

        expect(response.status).toBe(200);
        expect(await response.text()).toMatchInlineSnapshot(`
          type Query {
            ping: String
          }
      `);
      },
    );

    test.concurrent(
      'legacy deleting cdn access token from s3 revokes artifact cdn access',
      async ({ expect }) => {
        const { createOrg } = await initSeed().createOwner();
        const { createProject } = await createOrg();
        const { createTargetAccessToken, target } = await createProject(ProjectType.Single);
        const writeToken = await createTargetAccessToken({});

        await writeToken
          .publishSchema({
            author: 'Kamil',
            commit: 'abc123',
            sdl: `type Query { ping: String }`,
          })
          .then(r => r.expectNoGraphQLErrors());

        // manually generate CDN access token for legacy support
        const legacyToken = generateLegacyToken(target.id);
        const legacyTokenHash = await bcrypt.hash(legacyToken, await bcrypt.genSalt(10));
        await putS3Object(s3Client, 'artifacts', `cdn-legacy-keys/${target.id}`, legacyTokenHash);

        const endpointBaseUrl = await getBaseEndpoint();

        // First roundtrip
        const url = buildEndpointUrl(endpointBaseUrl, target.id, 'sdl');
        let response = await fetch(url, {
          method: 'GET',
          headers: {
            'x-hive-cdn-key': legacyToken,
          },
        });
        expect(response.status).toBe(200);
        expect(await response.text()).toMatchInlineSnapshot(`
          type Query {
            ping: String
          }
        `);

        await deleteS3Object(s3Client, 'artifacts', [`cdn-legacy-keys/${target.id}`]);

        // Second roundtrip
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'x-hive-cdn-key': legacyToken,
          },
        });
        expect(response.status).toBe(403);
      },
    );

    test.concurrent('access without credentials', async () => {
      const endpointBaseUrl = await getBaseEndpoint();
      const url = buildEndpointUrl(endpointBaseUrl, 'i-do-not-exist', 'sdl');
      const response = await fetch(url, { method: 'GET' });
      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.json()).toEqual({
        code: 'MISSING_AUTH_KEY',
        error: 'Hive CDN authentication key is missing',
        description:
          'Please refer to the documentation for more details: https://docs.graphql-hive.com/features/registry-usage ',
      });
      expect(response.headers.get('location')).toBe(null);
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
      expect(response.status).toBe(403);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.json()).toEqual({
        code: 'INVALID_AUTH_KEY',
        error:
          'Hive CDN authentication key is invalid, or it does not match the requested target ID.',
        description:
          'Please refer to the documentation for more details: https://docs.graphql-hive.com/features/registry-usage ',
      });
      expect(response.headers.get('location')).toBe(null);
    });

    test.concurrent('access SDL artifact with valid credentials', async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, createCdnAccess, target } = await createProject(
        ProjectType.Single,
      );
      const writeToken = await createTargetAccessToken({});

      // Publish Schema
      const publishSchemaResult = await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(publishSchemaResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
      const cdnAccessResult = await createCdnAccess();
      const endpointBaseUrl = await getBaseEndpoint();
      const url = buildEndpointUrl(endpointBaseUrl, target.id, 'sdl');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
        },
        redirect: 'manual',
      });

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toMatchInlineSnapshot(`
        type Query {
          ping: String
        }
      `);

      const artifactContents = await fetchS3ObjectArtifact(
        'artifacts',
        `artifact/${target.id}/sdl`,
      );
      expect(artifactContents.body).toMatchInlineSnapshot(`
        type Query {
          ping: String
        }
      `);
    });

    test.concurrent('access services artifact with valid credentials', async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, createCdnAccess, target } = await createProject(
        ProjectType.Federation,
      );
      const writeToken = await createTargetAccessToken({});

      // Publish Schema
      const publishSchemaResult = await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
          service: 'ping',
          url: 'http://ping.com',
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(publishSchemaResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

      // check if artifact exists in bucket
      const artifactContents = await fetchS3ObjectArtifact(
        'artifacts',
        `artifact/${target.id}/services`,
      );
      expect(artifactContents.body).toMatchInlineSnapshot(
        `[{"name":"ping","sdl":"type Query {\\n  ping: String\\n}","url":"http://ping.com"}]`,
      );

      const cdnAccessResult = await createCdnAccess();
      const endpointBaseUrl = await getBaseEndpoint();
      const url = buildEndpointUrl(endpointBaseUrl, target.id, 'services');
      let response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
        },
        redirect: 'manual',
      });

      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toMatchInlineSnapshot(
        `[{"name":"ping","sdl":"type Query {\\n  ping: String\\n}","url":"http://ping.com"}]`,
      );
    });

    test.concurrent('access services artifact with if-none-match header', async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, createCdnAccess, target } = await createProject(
        ProjectType.Federation,
      );
      const writeToken = await createTargetAccessToken({});

      // Publish Schema

      const publishSchemaResult = await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
          service: 'ping',
          url: 'http://ping.com',
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(publishSchemaResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

      // check if artifact exists in bucket
      const artifactContents = await fetchS3ObjectArtifact(
        'artifacts',
        `artifact/${target.id}/services`,
      );
      expect(artifactContents.body).toMatchInlineSnapshot(
        `[{"name":"ping","sdl":"type Query {\\n  ping: String\\n}","url":"http://ping.com"}]`,
      );

      const cdnAccessResult = await createCdnAccess();
      const endpointBaseUrl = await getBaseEndpoint();
      const url = buildEndpointUrl(endpointBaseUrl, target.id, 'services');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
          'if-none-match': artifactContents.eTag,
        },
        redirect: 'manual',
      });

      expect(response.status).toBe(304);
    });

    test.concurrent('access services artifact with ApolloGateway and ApolloServer', async () => {
      const endpointBaseUrl = await getBaseEndpoint();
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, createCdnAccess, target } = await createProject(
        ProjectType.Federation,
      );
      const writeToken = await createTargetAccessToken({});

      // Publish Schema
      const publishSchemaResult = await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: 'type Query { ping: String }',
          service: 'ping',
          url: 'http://ping.com',
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(publishSchemaResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
      const cdnAccessResult = await createCdnAccess();

      const gateway = new ApolloGateway({
        supergraphSdl: createSupergraphManager({
          endpoint: endpointBaseUrl + target.id,
          key: cdnAccessResult.secretAccessToken,
        }),
      });

      const server = new ApolloServer({ gateway });

      try {
        const { url } = await startStandaloneServer(server);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              {
                __schema {
                  types {
                    name
                    fields {
                      name
                    }
                  }
                }
              }
            `,
          }),
        });

        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.data.__schema.types).toContainEqual({
          name: 'Query',
          fields: [{ name: 'ping' }],
        });
      } finally {
        await server.stop();
      }
    });

    test.concurrent('access versioned SDL artifact with valid credentials', async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, createCdnAccess, target } = await createProject(
        ProjectType.Single,
      );
      const writeToken = await createTargetAccessToken({});

      // Publish Schema
      const publishSchemaResult = await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(publishSchemaResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

      // Fetch the latest valid version to get the version ID
      const latestVersion = await writeToken.fetchLatestValidSchema();
      const versionId = latestVersion.latestValidVersion?.id;
      expect(versionId).toBeDefined();

      const cdnAccessResult = await createCdnAccess();
      const endpointBaseUrl = await getBaseEndpoint();

      // Test latest endpoint
      const latestUrl = buildEndpointUrl(endpointBaseUrl, target.id, 'sdl');
      const latestResponse = await fetch(latestUrl, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
        },
      });
      expect(latestResponse.status).toBe(200);
      const latestBody = await latestResponse.text();

      // Test versioned endpoint
      const versionedUrl = buildVersionedEndpointUrl(endpointBaseUrl, target.id, versionId!, 'sdl');
      const versionedResponse = await fetch(versionedUrl, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
        },
      });

      expect(versionedResponse.status).toBe(200);
      const versionedBody = await versionedResponse.text();

      // Both should return the same content
      expect(versionedBody).toBe(latestBody);
      expect(versionedBody).toMatchInlineSnapshot(`
          type Query {
            ping: String
          }
        `);

      // Verify the versioned S3 key exists
      const versionedArtifact = await fetchS3ObjectArtifact(
        'artifacts',
        `artifact/${target.id}/version/${versionId}/sdl`,
      );
      expect(versionedArtifact.body).toBe(latestBody);

      expect(versionedResponse.headers.get('cache-control')).toBe(
        'public, max-age=31536000, immutable',
      );
    });

    test.concurrent(
      'versioned artifact returns 404 for non-existent version',
      async ({ expect }) => {
        const { createOrg } = await initSeed().createOwner();
        const { createProject } = await createOrg();
        const { createTargetAccessToken, createCdnAccess, target } = await createProject(
          ProjectType.Single,
        );
        const writeToken = await createTargetAccessToken({});

        // Publish Schema
        await writeToken
          .publishSchema({
            author: 'Kamil',
            commit: 'abc123',
            sdl: `type Query { ping: String }`,
          })
          .then(r => r.expectNoGraphQLErrors());

        const cdnAccessResult = await createCdnAccess();
        const endpointBaseUrl = await getBaseEndpoint();

        // Use a non-existent but valid UUID
        const nonExistentVersionId = '00000000-0000-0000-0000-000000000000';
        const versionedUrl = buildVersionedEndpointUrl(
          endpointBaseUrl,
          target.id,
          nonExistentVersionId,
          'sdl',
        );

        const response = await fetch(versionedUrl, {
          method: 'GET',
          headers: {
            'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
          },
        });

        expect(response.status).toBe(404);
      },
    );

    test.concurrent(
      'versioned artifact returns 404 for invalid UUID format',
      async ({ expect }) => {
        const { createOrg } = await initSeed().createOwner();
        const { createProject } = await createOrg();
        const { createTargetAccessToken, createCdnAccess, target } = await createProject(
          ProjectType.Single,
        );
        const writeToken = await createTargetAccessToken({});

        // Publish Schema
        await writeToken
          .publishSchema({
            author: 'Kamil',
            commit: 'abc123',
            sdl: `type Query { ping: String }`,
          })
          .then(r => r.expectNoGraphQLErrors());

        const cdnAccessResult = await createCdnAccess();
        const endpointBaseUrl = await getBaseEndpoint();

        // Use an invalid UUID format
        const invalidVersionId = 'not-a-valid-uuid';
        const versionedUrl = buildVersionedEndpointUrl(
          endpointBaseUrl,
          target.id,
          invalidVersionId,
          'sdl',
        );

        const response = await fetch(versionedUrl, {
          method: 'GET',
          headers: {
            'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
          },
        });

        expect(response.status).toBe(404);
      },
    );

    test.concurrent('access versioned federation supergraph artifact', async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, createCdnAccess, target } = await createProject(
        ProjectType.Federation,
      );
      const writeToken = await createTargetAccessToken({});

      // Publish Schema
      const publishSchemaResult = await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
          service: 'ping',
          url: 'http://ping.com',
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(publishSchemaResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

      // Fetch the latest valid version to get the version ID
      const latestVersion = await writeToken.fetchLatestValidSchema();
      const versionId = latestVersion.latestValidVersion?.id;
      expect(versionId).toBeDefined();

      const cdnAccessResult = await createCdnAccess();
      const endpointBaseUrl = await getBaseEndpoint();

      // Test versioned supergraph endpoint
      const versionedUrl = buildVersionedEndpointUrl(
        endpointBaseUrl,
        target.id,
        versionId!,
        'supergraph',
      );
      const versionedResponse = await fetch(versionedUrl, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
        },
      });

      expect(versionedResponse.status).toBe(200);
      const supergraphBody = await versionedResponse.text();
      expect(supergraphBody).toContain('schema');

      // Verify the versioned S3 key exists
      const versionedArtifact = await fetchS3ObjectArtifact(
        'artifacts',
        `artifact/${target.id}/version/${versionId}/supergraph`,
      );
      expect(versionedArtifact.body).toBe(supergraphBody);

      expect(versionedResponse.headers.get('cache-control')).toBe(
        'public, max-age=31536000, immutable',
      );
    });

    test.concurrent('access versioned federation services artifact', async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, createCdnAccess, target } = await createProject(
        ProjectType.Federation,
      );
      const writeToken = await createTargetAccessToken({});

      // Publish Schema
      const publishSchemaResult = await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
          service: 'ping',
          url: 'http://ping.com',
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(publishSchemaResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

      // Fetch the latest valid version to get the version ID
      const latestVersion = await writeToken.fetchLatestValidSchema();
      const versionId = latestVersion.latestValidVersion?.id;
      expect(versionId).toBeDefined();

      const cdnAccessResult = await createCdnAccess();
      const endpointBaseUrl = await getBaseEndpoint();

      // Test versioned services endpoint
      const versionedUrl = buildVersionedEndpointUrl(
        endpointBaseUrl,
        target.id,
        versionId!,
        'services',
      );
      const versionedResponse = await fetch(versionedUrl, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
        },
      });

      expect(versionedResponse.status).toBe(200);
      expect(versionedResponse.headers.get('content-type')).toContain('application/json');
      const servicesBody = await versionedResponse.text();
      expect(servicesBody).toMatchInlineSnapshot(
        `[{"name":"ping","sdl":"type Query {\\n  ping: String\\n}","url":"http://ping.com"}]`,
      );

      // Verify the versioned S3 key exists
      const versionedArtifact = await fetchS3ObjectArtifact(
        'artifacts',
        `artifact/${target.id}/version/${versionId}/services`,
      );
      expect(versionedArtifact.body).toBe(servicesBody);

      expect(versionedResponse.headers.get('cache-control')).toBe(
        'public, max-age=31536000, immutable',
      );
    });

    test.concurrent('access versioned federation metadata artifact', async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, createCdnAccess, target } = await createProject(
        ProjectType.Federation,
      );
      const writeToken = await createTargetAccessToken({});

      // Publish Schema with metadata
      const publishSchemaResult = await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
          service: 'ping',
          url: 'http://ping.com',
          metadata: JSON.stringify({ version: '1.0' }),
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(publishSchemaResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

      // Fetch the latest valid version to get the version ID
      const latestVersion = await writeToken.fetchLatestValidSchema();
      const versionId = latestVersion.latestValidVersion?.id;
      expect(versionId).toBeDefined();

      const cdnAccessResult = await createCdnAccess();
      const endpointBaseUrl = await getBaseEndpoint();

      // Test versioned metadata endpoint
      const versionedUrl = buildVersionedEndpointUrl(
        endpointBaseUrl,
        target.id,
        versionId!,
        'metadata',
      );
      const versionedResponse = await fetch(versionedUrl, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
        },
      });

      expect(versionedResponse.status).toBe(200);
      expect(versionedResponse.headers.get('content-type')).toContain('application/json');
      const metadataBody = await versionedResponse.text();
      // Federation metadata contains the metadata we published
      expect(metadataBody).toContain('version');

      // Verify the versioned S3 key exists
      const versionedArtifact = await fetchS3ObjectArtifact(
        'artifacts',
        `artifact/${target.id}/version/${versionId}/metadata`,
      );
      expect(versionedArtifact.body).toBe(metadataBody);

      expect(versionedResponse.headers.get('cache-control')).toBe(
        'public, max-age=31536000, immutable',
      );
      expect(versionedResponse.headers.get('x-hive-schema-version-id')).toBe(versionId);
    });

    test.concurrent('versioned artifact access without credentials', async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, target } = await createProject(ProjectType.Single);
      const writeToken = await createTargetAccessToken({});

      await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
        })
        .then(r => r.expectNoGraphQLErrors());

      const latestVersion = await writeToken.fetchLatestValidSchema();
      const versionId = latestVersion.latestValidVersion?.id;
      expect(versionId).toBeDefined();

      const endpointBaseUrl = await getBaseEndpoint();
      const versionedUrl = buildVersionedEndpointUrl(endpointBaseUrl, target.id, versionId!, 'sdl');

      // Request without credentials
      const response = await fetch(versionedUrl, { method: 'GET' });
      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.json()).toEqual({
        code: 'MISSING_AUTH_KEY',
        error: 'Hive CDN authentication key is missing',
        description:
          'Please refer to the documentation for more details: https://docs.graphql-hive.com/features/registry-usage ',
      });
    });

    test.concurrent('versioned artifact access with invalid credentials', async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, target } = await createProject(ProjectType.Single);
      const writeToken = await createTargetAccessToken({});

      await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
        })
        .then(r => r.expectNoGraphQLErrors());

      const latestVersion = await writeToken.fetchLatestValidSchema();
      const versionId = latestVersion.latestValidVersion?.id;
      expect(versionId).toBeDefined();

      const endpointBaseUrl = await getBaseEndpoint();
      const versionedUrl = buildVersionedEndpointUrl(endpointBaseUrl, target.id, versionId!, 'sdl');

      // Request with invalid credentials
      const response = await fetch(versionedUrl, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': 'invalid-key',
        },
      });
      expect(response.status).toBe(403);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.json()).toEqual({
        code: 'INVALID_AUTH_KEY',
        error:
          'Hive CDN authentication key is invalid, or it does not match the requested target ID.',
        description:
          'Please refer to the documentation for more details: https://docs.graphql-hive.com/features/registry-usage ',
      });
    });

    test.concurrent('CDN response includes x-hive-schema-version-id header', async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, createCdnAccess, target } = await createProject(
        ProjectType.Single,
      );
      const writeToken = await createTargetAccessToken({});

      // Publish Schema
      await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
        })
        .then(r => r.expectNoGraphQLErrors());

      // Fetch the latest valid version to get the version ID
      const latestVersion = await writeToken.fetchLatestValidSchema();
      const versionId = latestVersion.latestValidVersion?.id;
      expect(versionId).toBeDefined();

      const cdnAccessResult = await createCdnAccess();
      const endpointBaseUrl = await getBaseEndpoint();

      // Test latest endpoint returns x-hive-schema-version-id header
      const latestUrl = buildEndpointUrl(endpointBaseUrl, target.id, 'sdl');
      const latestResponse = await fetch(latestUrl, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
        },
      });
      expect(latestResponse.status).toBe(200);
      expect(latestResponse.headers.get('x-hive-schema-version-id')).toBe(versionId);

      // Test versioned endpoint also returns x-hive-schema-version-id header
      const versionedUrl = buildVersionedEndpointUrl(endpointBaseUrl, target.id, versionId!, 'sdl');
      const versionedResponse = await fetch(versionedUrl, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
        },
      });
      expect(versionedResponse.status).toBe(200);
      expect(versionedResponse.headers.get('x-hive-schema-version-id')).toBe(versionId);
    });

    test.concurrent('versioned artifact with if-none-match returns 304', async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, createCdnAccess, target } = await createProject(
        ProjectType.Single,
      );
      const writeToken = await createTargetAccessToken({});

      // Publish Schema
      await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
        })
        .then(r => r.expectNoGraphQLErrors());

      // Fetch the latest valid version to get the version ID
      const latestVersion = await writeToken.fetchLatestValidSchema();
      const versionId = latestVersion.latestValidVersion?.id;
      expect(versionId).toBeDefined();

      const cdnAccessResult = await createCdnAccess();
      const endpointBaseUrl = await getBaseEndpoint();

      // First request to get ETag
      const versionedUrl = buildVersionedEndpointUrl(endpointBaseUrl, target.id, versionId!, 'sdl');
      const firstResponse = await fetch(versionedUrl, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
        },
      });

      expect(firstResponse.status).toBe(200);
      const etag = firstResponse.headers.get('etag');
      expect(etag).toBeDefined();

      // Second request with If-None-Match should return 304
      const secondResponse = await fetch(versionedUrl, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
          'if-none-match': etag!,
        },
      });

      expect(secondResponse.status).toBe(304);
    });

    test.concurrent(
      'versioned artifact remains immutable after new schema publish',
      async ({ expect }) => {
        const { createOrg } = await initSeed().createOwner();
        const { createProject } = await createOrg();
        const { createTargetAccessToken, createCdnAccess, target } = await createProject(
          ProjectType.Single,
        );
        const writeToken = await createTargetAccessToken({});

        // Publish V1 schema
        await writeToken
          .publishSchema({
            author: 'Kamil',
            commit: 'v1',
            sdl: `type Query { ping: String }`,
          })
          .then(r => r.expectNoGraphQLErrors());

        const v1Version = await writeToken.fetchLatestValidSchema();
        const v1VersionId = v1Version.latestValidVersion?.id;
        expect(v1VersionId).toBeDefined();

        const cdnAccessResult = await createCdnAccess();
        const endpointBaseUrl = await getBaseEndpoint();

        // Fetch V1 content
        const v1Url = buildVersionedEndpointUrl(endpointBaseUrl, target.id, v1VersionId!, 'sdl');
        const v1Response = await fetch(v1Url, {
          method: 'GET',
          headers: { 'x-hive-cdn-key': cdnAccessResult.secretAccessToken },
        });
        expect(v1Response.status).toBe(200);
        const v1Content = await v1Response.text();
        expect(v1Content).toContain('ping');

        // Publish V2 schema with different content
        await writeToken
          .publishSchema({
            author: 'Kamil',
            commit: 'v2',
            sdl: `type Query { ping: String, pong: String }`,
          })
          .then(r => r.expectNoGraphQLErrors());

        const v2Version = await writeToken.fetchLatestValidSchema();
        const v2VersionId = v2Version.latestValidVersion?.id;
        expect(v2VersionId).toBeDefined();
        expect(v2VersionId).not.toBe(v1VersionId);

        // Verify V1 versioned endpoint still returns original content
        const v1ResponseAfterV2 = await fetch(v1Url, {
          method: 'GET',
          headers: { 'x-hive-cdn-key': cdnAccessResult.secretAccessToken },
        });
        expect(v1ResponseAfterV2.status).toBe(200);
        const v1ContentAfterV2 = await v1ResponseAfterV2.text();
        expect(v1ContentAfterV2).toBe(v1Content);
        expect(v1ContentAfterV2).not.toContain('pong');

        // Verify latest endpoint returns V2 content
        const latestUrl = buildEndpointUrl(endpointBaseUrl, target.id, 'sdl');
        const latestResponse = await fetch(latestUrl, {
          method: 'GET',
          headers: { 'x-hive-cdn-key': cdnAccessResult.secretAccessToken },
        });
        expect(latestResponse.status).toBe(200);
        const latestContent = await latestResponse.text();
        expect(latestContent).toContain('pong');

        // Verify headers point to correct versions
        expect(v1ResponseAfterV2.headers.get('x-hive-schema-version-id')).toBe(v1VersionId);
        expect(latestResponse.headers.get('x-hive-schema-version-id')).toBe(v2VersionId);
      },
    );

    test.concurrent('x-hive-schema-version-id header on all artifact types', async ({ expect }) => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, createCdnAccess, target } = await createProject(
        ProjectType.Federation,
      );
      const writeToken = await createTargetAccessToken({});

      // Publish Federation schema with metadata (required for metadata artifact)
      await writeToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
          service: 'ping',
          url: 'http://ping.com',
          metadata: JSON.stringify({ version: '1.0' }),
        })
        .then(r => r.expectNoGraphQLErrors());

      const latestVersion = await writeToken.fetchLatestValidSchema();
      const versionId = latestVersion.latestValidVersion?.id;
      expect(versionId).toBeDefined();

      const cdnAccessResult = await createCdnAccess();
      const endpointBaseUrl = await getBaseEndpoint();

      // Test SDL artifact
      const sdlResponse = await fetch(buildEndpointUrl(endpointBaseUrl, target.id, 'sdl'), {
        method: 'GET',
        headers: { 'x-hive-cdn-key': cdnAccessResult.secretAccessToken },
      });
      expect(sdlResponse.status).toBe(200);
      expect(sdlResponse.headers.get('x-hive-schema-version-id')).toBe(versionId);

      // Test services artifact
      const servicesResponse = await fetch(
        buildEndpointUrl(endpointBaseUrl, target.id, 'services'),
        {
          method: 'GET',
          headers: { 'x-hive-cdn-key': cdnAccessResult.secretAccessToken },
        },
      );
      expect(servicesResponse.status).toBe(200);
      expect(servicesResponse.headers.get('x-hive-schema-version-id')).toBe(versionId);

      // Test supergraph artifact
      const supergraphResponse = await fetch(
        buildEndpointUrl(endpointBaseUrl, target.id, 'supergraph'),
        {
          method: 'GET',
          headers: { 'x-hive-cdn-key': cdnAccessResult.secretAccessToken },
        },
      );
      expect(supergraphResponse.status).toBe(200);
      expect(supergraphResponse.headers.get('x-hive-schema-version-id')).toBe(versionId);

      // Test metadata artifact
      const metadataResponse = await fetch(
        buildEndpointUrl(endpointBaseUrl, target.id, 'metadata'),
        {
          method: 'GET',
          headers: { 'x-hive-cdn-key': cdnAccessResult.secretAccessToken },
        },
      );
      expect(metadataResponse.status).toBe(200);
      expect(metadataResponse.headers.get('x-hive-schema-version-id')).toBe(versionId);
    });

    test.concurrent('publishes a graph manifest with valid artifact paths', async ({ expect }) => {
      const { createOrg, ownerToken } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createTargetAccessToken, createCdnAccess, target } = await createProject(
        ProjectType.Federation,
      );
      const writeToken = await createTargetAccessToken({});

      await writeToken
        .publishSchema({
          sdl: /* GraphQL */ `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

            type Query {
              hello: String
              internal: String @tag(name: "internal")
            }
          `,
          service: 'hello',
          url: 'http://hello.com',
        })
        .then(r => r.expectNoGraphQLErrors());

      const createContractResult = await execute({
        document: CreateContractMutation,
        variables: {
          input: {
            target: { byId: target.id },
            contractName: 'my-contract',
            removeUnreachableTypesFromPublicApiSchema: true,
            includeTags: ['internal'],
          },
        },
        authToken: ownerToken,
      }).then(r => r.expectNoGraphQLErrors());
      expect(createContractResult.createContract.error).toBeNull();

      await writeToken
        .publishSchema({
          sdl: /* GraphQL */ `
            extend schema
              @link(url: "https://specs.apollo.dev/link/v1.0")
              @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

            type Query {
              hello: String
              internal: String @tag(name: "internal")
              goodbye: String
            }
          `,
          service: 'hello',
          url: 'http://hello.com',
        })
        .then(r => r.expectNoGraphQLErrors());

      const cdnAccessResult = await createCdnAccess();
      const endpointBaseUrl = await getBaseEndpoint();
      const headers = { 'x-hive-cdn-key': cdnAccessResult.secretAccessToken };
      const manifestResponse = await fetch(`${endpointBaseUrl}${target.id}/manifest.json`, {
        headers,
      });

      expect(manifestResponse.status).toBe(200);
      const manifest = (await manifestResponse.json()) as {
        graphs: Record<
          string,
          { id: string; currentVersion: { id: string; artifactPath: string } }
        >;
      };

      expect(Object.keys(manifest.graphs)).toEqual(
        expect.arrayContaining(['default', 'default/my-contract']),
      );

      for (const graph of Object.values(manifest.graphs)) {
        expect(graph.id).toBeTruthy();
        expect(graph.currentVersion.id).toBeTruthy();
        expect(graph.currentVersion.artifactPath).toMatch(/^\/artifacts\/v1\//);

        for (const artifactType of ['sdl', 'supergraph']) {
          const artifactResponse = await fetch(
            new URL(`${graph.currentVersion.artifactPath}/${artifactType}`, endpointBaseUrl),
            { headers },
          );
          expect(
            artifactResponse.status,
            `${graph.currentVersion.artifactPath}/${artifactType}`,
          ).toBe(200);

          expect(artifactResponse.headers.get('x-hive-schema-version-id')).toBe(
            graph.currentVersion.id,
          );
          expect(artifactResponse.headers.get('x-hive-graph-version-id')).toBe(
            graph.currentVersion.id,
          );
          expect(artifactResponse.headers.get('x-hive-graph-id')).toBe(graph.id);
        }
      }
    });

    test.concurrent(
      'access versioned contract artifact with valid credentials',
      async ({ expect }) => {
        const { createOrg, ownerToken } = await initSeed().createOwner();
        const { createProject } = await createOrg();
        const { createTargetAccessToken, createCdnAccess, target } = await createProject(
          ProjectType.Federation,
        );

        const writeToken = await createTargetAccessToken({});

        // Publish initial schema with @tag directive
        await writeToken
          .publishSchema({
            sdl: /* GraphQL */ `
              extend schema
                @link(url: "https://specs.apollo.dev/link/v1.0")
                @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

              type Query {
                hello: String
                helloHidden: String @tag(name: "internal")
              }
            `,
            service: 'hello',
            url: 'http://hello.com',
          })
          .then(r => r.expectNoGraphQLErrors());

        // Create a contract
        const createContractResult = await execute({
          document: CreateContractMutation,
          variables: {
            input: {
              target: { byId: target.id },
              contractName: 'my-contract',
              removeUnreachableTypesFromPublicApiSchema: true,
              includeTags: ['internal'],
            },
          },
          authToken: ownerToken,
        }).then(r => r.expectNoGraphQLErrors());

        expect(createContractResult.createContract.error).toBeNull();

        // Publish schema again to generate contract artifacts
        await writeToken
          .publishSchema({
            sdl: /* GraphQL */ `
              extend schema
                @link(url: "https://specs.apollo.dev/link/v1.0")
                @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

              type Query {
                hello: String
                helloHidden: String @tag(name: "internal")
              }
            `,
            service: 'hello',
            url: 'http://hello.com',
          })
          .then(r => r.expectNoGraphQLErrors());

        // Fetch the latest valid version to get the version ID
        const latestVersion = await writeToken.fetchLatestValidSchema();
        const versionId = latestVersion.latestValidVersion?.id;
        expect(versionId).toBeDefined();

        const cdnAccessResult = await createCdnAccess();
        const endpointBaseUrl = await getBaseEndpoint();

        // Test versioned contract SDL endpoint
        const versionedContractSdlUrl = buildVersionedContractEndpointUrl(
          endpointBaseUrl,
          target.id,
          versionId!,
          'my-contract',
          'sdl',
        );
        const contractSdlResponse = await fetch(versionedContractSdlUrl, {
          method: 'GET',
          headers: {
            'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
          },
        });

        expect(contractSdlResponse.status).toBe(200);
        const contractSdlBody = await contractSdlResponse.text();
        expect(contractSdlBody).toContain('helloHidden');
        expect(contractSdlResponse.headers.get('cache-control')).toBe(
          'public, max-age=31536000, immutable',
        );
        expect(contractSdlResponse.headers.get('x-hive-schema-version-id')).toBe(versionId);

        // Test versioned contract supergraph endpoint
        const versionedContractSupergraphUrl = buildVersionedContractEndpointUrl(
          endpointBaseUrl,
          target.id,
          versionId!,
          'my-contract',
          'supergraph',
        );
        const contractSupergraphResponse = await fetch(versionedContractSupergraphUrl, {
          method: 'GET',
          headers: {
            'x-hive-cdn-key': cdnAccessResult.secretAccessToken,
          },
        });

        expect(contractSupergraphResponse.status).toBe(200);
        expect(contractSupergraphResponse.headers.get('cache-control')).toBe(
          'public, max-age=31536000, immutable',
        );
        expect(contractSupergraphResponse.headers.get('x-hive-schema-version-id')).toBe(versionId);
      },
    );
  });
}

runArtifactsCDNTests('API Mirror', { service: 'server', port: 8082, path: '/artifacts/v1/' });

describe('CDN token', () => {
  const TargetCDNAccessTokensQuery = graphql(`
    query TargetCDNAccessTokens($selector: TargetSelectorInput!, $after: String, $first: Int = 2) {
      target(reference: { bySelector: $selector }) {
        cdnAccessTokens(first: $first, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            cursor
            node {
              id
              firstCharacters
              lastCharacters
              createdAt
            }
          }
        }
      }
    }
  `);

  const DeleteCDNAccessTokenMutation = graphql(`
    mutation DeleteCDNAccessToken($input: DeleteCdnAccessTokenInput!) {
      deleteCdnAccessToken(input: $input) {
        error {
          message
        }
        ok {
          deletedCdnAccessTokenId
        }
      }
    }
  `);

  it('connection pagination', async () => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { organization, createProject } = await createOrg();
    const { project, target, createCdnAccess, createTargetAccessToken } = await createProject(
      ProjectType.Federation,
    );

    await Promise.all(new Array(5).fill(0).map(() => createCdnAccess()));

    let result = await execute({
      document: TargetCDNAccessTokensQuery,
      variables: {
        selector: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(result.target!.cdnAccessTokens.edges).toHaveLength(2);
    expect(result.target!.cdnAccessTokens.pageInfo.hasNextPage).toBe(true);
    let endCursor = result.target!.cdnAccessTokens.pageInfo.endCursor;

    result = await execute({
      document: TargetCDNAccessTokensQuery,
      variables: {
        selector: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        after: endCursor,
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(result.target!.cdnAccessTokens.edges).toHaveLength(2);
    expect(result.target!.cdnAccessTokens.pageInfo.hasNextPage).toBe(true);
    endCursor = result.target!.cdnAccessTokens.pageInfo.endCursor;

    result = await execute({
      document: TargetCDNAccessTokensQuery,
      variables: {
        selector: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        after: endCursor,
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(result.target!.cdnAccessTokens.edges).toHaveLength(1);
    expect(result.target!.cdnAccessTokens.pageInfo.hasNextPage).toBe(false);
  });

  it('new created access tokens are added at the beginning of the connection', async () => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { organization, createProject } = await createOrg();
    const { project, target, createCdnAccess } = await createProject(ProjectType.Federation);

    await createCdnAccess();

    const firstResult = await execute({
      document: TargetCDNAccessTokensQuery,
      variables: {
        selector: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        first: 2,
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    const firstId = firstResult.target!.cdnAccessTokens.edges[0].node.id;
    expect(firstResult.target!.cdnAccessTokens.edges).toHaveLength(1);

    await createCdnAccess();

    const secondResult = await execute({
      document: TargetCDNAccessTokensQuery,
      variables: {
        selector: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        first: 2,
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());
    expect(secondResult.target!.cdnAccessTokens.edges).toHaveLength(2);
    expect(secondResult.target!.cdnAccessTokens.edges[1].node.id).toBe(firstId);
  });

  it('delete cdn access token', async () => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { organization, createProject } = await createOrg();
    const { project, target, createCdnAccess } = await createProject(ProjectType.Federation);

    await createCdnAccess();

    let paginatedResult = await execute({
      document: TargetCDNAccessTokensQuery,
      variables: {
        selector: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        first: 1,
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());
    expect(paginatedResult.target!.cdnAccessTokens.edges).toHaveLength(1);

    const deleteResult = await execute({
      document: DeleteCDNAccessTokenMutation,
      variables: {
        input: {
          target: {
            bySelector: {
              organizationSlug: organization.slug,
              projectSlug: project.slug,
              targetSlug: target.slug,
            },
          },
          cdnAccessTokenId: paginatedResult.target!.cdnAccessTokens.edges[0].node.id,
        },
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());

    expect(deleteResult.deleteCdnAccessToken.ok).toBeDefined();
    expect(deleteResult.deleteCdnAccessToken.error).toBeNull();
    expect(deleteResult.deleteCdnAccessToken.ok!.deletedCdnAccessTokenId).toBe(
      paginatedResult.target!.cdnAccessTokens.edges[0].node.id,
    );

    paginatedResult = await execute({
      document: TargetCDNAccessTokensQuery,
      variables: {
        selector: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        first: 1,
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());
    expect(paginatedResult.target!.cdnAccessTokens.edges).toHaveLength(0);
  });

  it('delete cdn access token without access', async () => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { target, project, createCdnAccess } = await createProject(ProjectType.Federation);
    await createCdnAccess();

    const paginatedResult = await execute({
      document: TargetCDNAccessTokensQuery,
      variables: {
        selector: {
          organizationSlug: organization.slug,
          projectSlug: project.slug,
          targetSlug: target.slug,
        },
        first: 1,
      },
      authToken: ownerToken,
    }).then(r => r.expectNoGraphQLErrors());
    expect(paginatedResult.target!.cdnAccessTokens.edges).toHaveLength(1);

    const { ownerToken: otherOwnerToken } = await initSeed().createOwner();
    const deleteResult = await execute({
      document: DeleteCDNAccessTokenMutation,
      variables: {
        input: {
          target: {
            bySelector: {
              organizationSlug: organization.slug,
              projectSlug: project.slug,
              targetSlug: target.slug,
            },
          },
          cdnAccessTokenId: paginatedResult.target!.cdnAccessTokens.edges[0].node.id,
        },
      },
      authToken: otherOwnerToken,
    }).then(r => r.expectGraphQLErrors());

    expect(deleteResult).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: `No access (reason: "Missing permission for performing 'cdnAccessToken:modify' on resource")`,
        }),
      ]),
    );
  });
});
