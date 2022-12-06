import {
  S3Client,
  ListObjectsCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { fetch } from '@whatwg-node/fetch';
import { authenticate } from '../../testkit/auth';
import {
  createOrganization,
  createProject,
  createToken,
  publishSchema,
  createCdnAccess,
} from '../../testkit/flow';
import { ProjectType, TargetAccessScope } from '../../testkit/gql/graphql';

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
function runArtifactsCDNTests(name: string, endpointBaseUrl: string) {
  describe(`Artifacts CDN ${name}`, () => {
    test('access without credentials', async () => {
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

    test('access invalid credentials', async () => {
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

    test('access SDL artifact with valid credentials', async () => {
      const { access_token } = await authenticate('main');

      // Create Organization

      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token,
      );

      const org =
        orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      // Create Project

      const projectResult = await createProject(
        {
          organization: org.cleanId,
          type: ProjectType.Single,
          name: 'foo',
        },
        access_token,
      );

      const project = projectResult.body.data!.createProject.ok!.createdProject;
      const target = projectResult.body.data?.createProject.ok?.createdTargets.find(
        t => t.name === 'production',
      );

      // Create Schema Publish Token

      const tokenResult = await createToken(
        {
          name: 'test',
          organization: org.cleanId,
          project: project.cleanId,
          target: target!.cleanId,
          organizationScopes: [],
          projectScopes: [],
          targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
        },
        access_token,
      );

      expect(tokenResult.body.errors).not.toBeDefined();

      const token = tokenResult.body.data!.createToken.ok!.secret;

      // Publish Schema

      const publishSchemaResult = await publishSchema(
        {
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
        },
        token,
      );

      expect(publishSchemaResult.body.data?.schemaPublish.__typename).toEqual(
        'SchemaPublishSuccess',
      );

      const cdnAccessResult = await createCdnAccess(
        {
          organization: org.cleanId,
          project: project.cleanId,
          target: target!.cleanId,
        },
        access_token,
      );

      expect(cdnAccessResult.body.errors).toBeUndefined();

      const url = buildEndpointUrl(endpointBaseUrl, target!.id, 'sdl');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.body.data!.createCdnToken.token,
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

    test('access services artifact with valid credentials', async () => {
      const { access_token } = await authenticate('main');

      // Create Organization

      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token,
      );

      const org =
        orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      // Create Project

      const projectResult = await createProject(
        {
          organization: org.cleanId,
          type: ProjectType.Single,
          name: 'foo',
        },
        access_token,
      );

      const project = projectResult.body.data!.createProject.ok!.createdProject;
      const target = projectResult.body.data?.createProject.ok?.createdTargets.find(
        t => t.name === 'production',
      );

      // Create Schema Publish Token

      const tokenResult = await createToken(
        {
          name: 'test',
          organization: org.cleanId,
          project: project.cleanId,
          target: target!.cleanId,
          organizationScopes: [],
          projectScopes: [],
          targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
        },
        access_token,
      );

      expect(tokenResult.body.errors).not.toBeDefined();

      const token = tokenResult.body.data!.createToken.ok!.secret;

      // Publish Schema

      const publishSchemaResult = await publishSchema(
        {
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
        },
        token,
      );

      expect(publishSchemaResult.body.data?.schemaPublish.__typename).toEqual(
        'SchemaPublishSuccess',
      );

      // check if artifact exists in bucket
      const artifactContents = await fetchS3ObjectArtifact(
        'artifacts',
        `artifact/${target!.id}/services`,
      );
      expect(artifactContents.body).toMatchInlineSnapshot(
        `"[{"sdl":"type Query { ping: String }"}]"`,
      );

      const cdnAccessResult = await createCdnAccess(
        {
          organization: org.cleanId,
          project: project.cleanId,
          target: target!.cleanId,
        },
        access_token,
      );

      expect(cdnAccessResult.body.errors).toBeUndefined();

      const url = buildEndpointUrl(endpointBaseUrl, target!.id, 'services');
      let response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.body.data!.createCdnToken.token,
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
      expect(locationUrl.port).toEqual('9002');

      response = await fetch(locationHeader!, {
        method: 'GET',
        redirect: 'manual',
      });
      const body = await response.text();
      expect(response.status).toEqual(200);
      expect(body).toMatchInlineSnapshot(`"[{"sdl":"type Query { ping: String }"}]"`);
    });

    test('access services artifact with if-none-match header', async () => {
      const { access_token } = await authenticate('main');

      // Create Organization

      const orgResult = await createOrganization(
        {
          name: 'foo',
        },
        access_token,
      );

      const org =
        orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

      // Create Project

      const projectResult = await createProject(
        {
          organization: org.cleanId,
          type: ProjectType.Single,
          name: 'foo',
        },
        access_token,
      );

      const project = projectResult.body.data!.createProject.ok!.createdProject;
      const target = projectResult.body.data?.createProject.ok?.createdTargets.find(
        t => t.name === 'production',
      );

      // Create Schema Publish Token

      const tokenResult = await createToken(
        {
          name: 'test',
          organization: org.cleanId,
          project: project.cleanId,
          target: target!.cleanId,
          organizationScopes: [],
          projectScopes: [],
          targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
        },
        access_token,
      );

      expect(tokenResult.body.errors).not.toBeDefined();

      const token = tokenResult.body.data!.createToken.ok!.secret;

      // Publish Schema

      const publishSchemaResult = await publishSchema(
        {
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
        },
        token,
      );

      expect(publishSchemaResult.body.data?.schemaPublish.__typename).toEqual(
        'SchemaPublishSuccess',
      );

      // check if artifact exists in bucket
      const artifactContents = await fetchS3ObjectArtifact(
        'artifacts',
        `artifact/${target!.id}/services`,
      );
      expect(artifactContents.body).toMatchInlineSnapshot(
        `"[{"sdl":"type Query { ping: String }"}]"`,
      );

      const cdnAccessResult = await createCdnAccess(
        {
          organization: org.cleanId,
          project: project.cleanId,
          target: target!.cleanId,
        },
        access_token,
      );

      expect(cdnAccessResult.body.errors).toBeUndefined();

      const url = buildEndpointUrl(endpointBaseUrl, target!.id, 'services');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-hive-cdn-key': cdnAccessResult.body.data!.createCdnToken.token,
          'if-none-match': artifactContents.eTag,
        },
        redirect: 'manual',
      });

      expect(response.status).toMatchInlineSnapshot(`304`);
    });
  });
}

runArtifactsCDNTests('API Mirror', 'http://127.0.0.1:3001/artifacts/v1/');
// runArtifactsCDNTests('Local CDN Mock', 'http://127.0.0.1:3004/artifacts/v1/');
