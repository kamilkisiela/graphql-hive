import 'reflect-metadata';
import { parse, print } from 'graphql';
import { enableExternalSchemaComposition } from 'testkit/flow';
import { ProjectAccessScope, ProjectType, TargetAccessScope } from 'testkit/gql/graphql';
import { initSeed } from 'testkit/seed';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createStorage } from '@hive/storage';
import { sortSDL } from '@theguild/federation-composition';
import { getServiceHost } from 'testkit/utils';

function connectionString() {
  const {
    POSTGRES_USER = 'postgres',
    POSTGRES_PASSWORD = 'postgres',
    POSTGRES_HOST = 'localhost',
    POSTGRES_PORT = 5432,
    POSTGRES_DB = 'registry',
    POSTGRES_SSL = null,
    POSTGRES_CONNECTION_STRING = null,
    // eslint-disable-next-line no-process-env
  } = process.env;
  return (
    POSTGRES_CONNECTION_STRING ||
    `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}${
      POSTGRES_SSL ? '?sslmode=require' : '?sslmode=disable'
    }`
  );
}

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
  return print(
    sortSDL(
      parse(sdl, {
        noLocation: true,
      }),
    ),
  );
}

test.concurrent(
  'can delete a service and updates the CDN when the super schema is still composable',
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

test.concurrent(
  'the changes and schema sdl is persisted in the database when the super schema schema is composable',
  async ({ expect }) => {
    let storage: Awaited<ReturnType<typeof createStorage>> | undefined = undefined;

    try {
      storage = await createStorage(connectionString(), 1);
      const { createOrg } = await initSeed().createOwner();
      const { createProject, organization } = await createOrg();
      const { createToken, project, target } = await createProject(ProjectType.Federation);

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

      const deleteServiceResult = await readToken
        .deleteSchema('foo1')
        .then(r => r.expectNoGraphQLErrors());
      expect(deleteServiceResult.schemaDelete.__typename).toBe('SchemaDeleteSuccess');

      const latestVersion = await storage.getLatestVersion({
        target: target.id,
        project: project.id,
        organization: organization.id,
      });

      expect(latestVersion.compositeSchemaSDL).toMatchInlineSnapshot(`
        type Query {
          ping: String
        }
      `);
      expect(latestVersion.schemaCompositionErrors).toEqual(null);
      expect(latestVersion.hasPersistedSchemaChanges).toEqual(true);
      expect(latestVersion.isComposable).toEqual(true);

      const changes = await storage.getSchemaChangesForVersion({
        versionId: latestVersion.id,
      });

      if (Array.isArray(changes) === false) {
        throw new Error('No changes were persisted in the database.');
      }

      expect(changes[0]).toMatchInlineSnapshot(`
        {
          approvalMetadata: null,
          breakingChangeSchemaCoordinate: Query.bruv,
          criticality: BREAKING,
          id: b3cb5845edf64492571c7b5c5857b7f9,
          isSafeBasedOnUsage: false,
          message: Field 'bruv' was removed from object type 'Query',
          meta: {
            isRemovedFieldDeprecated: false,
            removedFieldName: bruv,
            typeName: Query,
            typeType: object type,
          },
          path: Query.bruv,
          reason: Removing a field is a breaking change. It is preferable to deprecate the field before removing it.,
          type: FIELD_REMOVED,
          usageStatistics: null,
        }
      `);
    } finally {
      await storage?.destroy();
    }
  },
);

test.concurrent(
  'composition error is persisted in the database when the super schema schema is not composable',
  async ({ expect }) => {
    let storage: Awaited<ReturnType<typeof createStorage>> | undefined = undefined;

    try {
      storage = await createStorage(connectionString(), 1);
      const { createOrg } = await initSeed().createOwner();
      const { createProject, organization } = await createOrg();
      const { createToken, project, target, setNativeFederation } = await createProject(
        ProjectType.Federation,
      );

      const readToken = await createToken({
        targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
        projectScopes: [ProjectAccessScope.Settings],
      });

      await enableExternalSchemaComposition(
        {
          endpoint: `http://${await getServiceHost('composition_federation_2', 3069)}/compose`,
          // eslint-disable-next-line no-process-env
          secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
          project: project.cleanId,
          organization: organization.cleanId,
        },
        readToken.secret,
      ).then(r => r.expectNoGraphQLErrors());
      // Disable Native Federation v2 composition to allow the external composition to take place
      await setNativeFederation(false);

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

            type User @key(fields: "IDONOTEXIST") {
              id: String
            }
          `,
          service: 'foo1',
          url: 'http://localhost:4000/graphql',
        })
        .then(r => r.expectNoGraphQLErrors());
      expect(publishService2Result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

      const publishService1Result2 = await readToken
        .publishSchema({
          sdl: /* GraphQL */ `
            type Query {
              ping: String
            }

            type Brrrt @key(fields: "sdasdasd") {
              id: String
            }
          `,
          service: 'foo',
          url: 'http://localhost:4000/graphql',
        })
        .then(r => r.expectNoGraphQLErrors());
      expect(publishService1Result2.schemaPublish.__typename).toBe('SchemaPublishSuccess');

      const deleteServiceResult = await readToken
        .deleteSchema('foo')
        .then(r => r.expectNoGraphQLErrors());
      expect(deleteServiceResult.schemaDelete.__typename).toBe('SchemaDeleteSuccess');

      const latestVersion = await storage.getLatestVersion({
        target: target.id,
        project: project.id,
        organization: organization.id,
      });

      expect(latestVersion.compositeSchemaSDL).toEqual(null);
      expect(latestVersion.schemaCompositionErrors).toMatchInlineSnapshot(`
        [
          {
            message: [foo1] On type "User", for @key(fields: "IDONOTEXIST"): Cannot query field "IDONOTEXIST" on type "User" (the field should either be added to this subgraph or, if it should not be resolved by this subgraph, you need to add it to this subgraph with @external).,
            source: composition,
          },
        ]
      `);
    } finally {
      await storage?.destroy();
    }
  },
);
