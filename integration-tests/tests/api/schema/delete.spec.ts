import { initSeed } from 'testkit/seed';
import { ProjectType, TargetAccessScope } from '@app/gql/graphql';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  endpoint: 'http://127.0.0.1:9000',
  region: 'auto',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  },
  forcePathStyle: true,
});

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

function normalizeSDL(sdl: string): string {
  return sdl.replace(/[\n ]+/g, ' ');
}

test.concurrent(
  'can delete a service and updates database and CDN when the super schema is still composable',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken, target } = await createProject(ProjectType.Federation);

    const readToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
    });

    const publishService1Result = await readToken
      .publishSchema({
        sdl: /* GraphQL */ `
          type Query {
            ping: String
          }
        `,
        service: 'foo',
        url: 'http://localhost:4000/graphql',
      })
      .then(r => r.expectNoGraphQLErrors());
    expect(publishService1Result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const publishService2Result = await readToken
      .publishSchema({
        sdl: /* GraphQL */ `
          type Query {
            bruv: String
          }
        `,
        service: 'foo1',
        url: 'http://localhost:4000/graphql',
      })
      .then(r => r.expectNoGraphQLErrors());
    expect(publishService2Result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    let artifactContents = await fetchS3ObjectArtifact('artifacts', `artifact/${target.id}/sdl`);
    expect(normalizeSDL(artifactContents.body)).toMatch(
      normalizeSDL(/* GraphQL */ `
        type Query {
          bruv: String
          ping: String
        }
      `),
    );

    const deleteServiceResult = await readToken
      .deleteSchema('foo1')
      .then(r => r.expectNoGraphQLErrors());
    expect(deleteServiceResult.schemaDelete.__typename).toBe('SchemaDeleteSuccess');

    // Ensure CDN artifacts are updated.

    artifactContents = await fetchS3ObjectArtifact('artifacts', `artifact/${target.id}/sdl`);
    expect(normalizeSDL(artifactContents.body)).toMatch(
      normalizeSDL(/* GraphQL */ `
        type Query {
          ping: String
        }
      `),
    );
  },
);
