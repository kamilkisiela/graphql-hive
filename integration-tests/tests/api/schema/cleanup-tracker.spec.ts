import 'reflect-metadata';
import { sql, type CommonQueryMethods } from 'slonik';
/* eslint-disable no-process-env */
import { ProjectType, TargetAccessScope } from 'testkit/gql/graphql';
import { test } from 'vitest';
import { initSeed } from '../../../testkit/seed';

async function fetchCoordinates(db: CommonQueryMethods, target: { id: string }) {
  const result = await db.query<{
    coordinate: string;
    created_in_version_id: string;
    deprecated_in_version_id: string | null;
  }>(sql`
    SELECT coordinate, created_in_version_id, deprecated_in_version_id
    FROM schema_coordinate_status WHERE target_id = ${target.id}
  `);

  return result.rows;
}

describe.skip('schema cleanup tracker', () => {
  test.concurrent('single', async ({ expect }) => {
    const { publishSchema, target, createDbConnection } = await prepare();
    // This API is soooooooooooo awkward xD
    await using db = await createDbConnection();

    const ver1 = await publishSchema(/* GraphQL */ `
      type Query {
        hello: String
      }
    `);

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.hello',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
      ]),
    );

    const ver2 = await publishSchema(/* GraphQL */ `
      type Query {
        hello: String
        hi: String
      }
    `);

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.hello',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.hi',
          created_in_version_id: ver2,
          deprecated_in_version_id: null,
        }),
      ]),
    );

    await publishSchema(/* GraphQL */ `
      type Query {
        hello: String
      }
    `);

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.hello',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.not.objectContaining({
          coordinate: 'Query.hi',
          created_in_version_id: ver2,
          deprecated_in_version_id: null,
        }),
      ]),
    );

    const ver4 = await publishSchema(/* GraphQL */ `
      type Query {
        hello: String
        hi: String
      }
    `);

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.hello',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.hi',
          created_in_version_id: ver4,
          deprecated_in_version_id: null,
        }),
      ]),
    );

    const ver5 = await publishSchema(/* GraphQL */ `
      type Query {
        hello: String @deprecated(reason: "no longer needed")
        bye: String
        goodbye: String
        hi: String @deprecated(reason: "no longer needed")
      }
    `);

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.hello',
          created_in_version_id: ver1,
          deprecated_in_version_id: ver5,
        }),
        expect.objectContaining({
          coordinate: 'Query.bye',
          created_in_version_id: ver5,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.goodbye',
          created_in_version_id: ver5,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.hi',
          created_in_version_id: ver4,
          deprecated_in_version_id: ver5,
        }),
      ]),
    );

    await publishSchema(/* GraphQL */ `
      type Query {
        hello: String
        bye: String
        hi: String @deprecated(reason: "no longer needed")
      }
    `);

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.hello',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.bye',
          created_in_version_id: ver5,
          deprecated_in_version_id: null,
        }),
        expect.not.objectContaining({
          coordinate: 'Query.goodbye',
          created_in_version_id: ver5,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.hi',
          created_in_version_id: ver4,
          deprecated_in_version_id: ver5,
        }),
      ]),
    );
  });

  test.concurrent('federation', async ({ expect }) => {
    const { publishSchema, deleteSchema, target, createDbConnection } = await prepare(
      ProjectType.Federation,
    );
    await using db = await createDbConnection();

    const serviceFoo = {
      name: 'foo',
      url: 'https://api.com/foo',
    };

    const serviceBar = {
      name: 'bar',
      url: 'https://api.com/bar',
    };

    const ver1 = await publishSchema(
      /* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

        type Query {
          user(id: ID!): User
        }

        type User @key(fields: "id") {
          id: ID!
          name: String
        }
      `,
      serviceFoo,
    );

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.name',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
      ]),
    );

    const ver2 = await publishSchema(
      /* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

        type Query {
          users: User
        }

        type User @key(fields: "id") {
          id: ID!
          pictureUrl: String
        }
      `,
      serviceBar,
    );

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        // foo
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.name',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        // bar
        expect.objectContaining({
          coordinate: 'Query.users',
          created_in_version_id: ver2,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.pictureUrl',
          created_in_version_id: ver2,
          deprecated_in_version_id: null,
        }),
      ]),
    );

    await deleteSchema(serviceBar.name);

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        // foo
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.name',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        // bar
        expect.not.objectContaining({
          coordinate: 'Query.users',
          created_in_version_id: ver2,
          deprecated_in_version_id: null,
        }),
        expect.not.objectContaining({
          coordinate: 'User.pictureUrl',
          created_in_version_id: ver2,
          deprecated_in_version_id: null,
        }),
      ]),
    );

    const ver4 = await publishSchema(
      /* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

        type Query {
          users: User
        }

        type User @key(fields: "id") {
          id: ID!
          pictureUrl: String
        }
      `,
      serviceBar,
    );

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        // foo
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.name',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        // bar
        expect.objectContaining({
          coordinate: 'Query.users',
          created_in_version_id: ver4,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.pictureUrl',
          created_in_version_id: ver4,
          deprecated_in_version_id: null,
        }),
      ]),
    );

    const ver5 = await publishSchema(
      /* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

        type Query {
          users: User @deprecated(reason: "no longer needed")
          randomUser: User
          admin: User
        }

        type User @key(fields: "id") {
          id: ID!
          pictureUrl: String @deprecated(reason: "no longer needed")
        }
      `,
      serviceBar,
    );

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        // foo
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.name',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        // bar
        expect.objectContaining({
          coordinate: 'Query.users',
          created_in_version_id: ver4,
          deprecated_in_version_id: ver5,
        }),
        expect.objectContaining({
          coordinate: 'Query.randomUser',
          created_in_version_id: ver5,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.admin',
          created_in_version_id: ver5,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.pictureUrl',
          created_in_version_id: ver4,
          deprecated_in_version_id: ver5,
        }),
      ]),
    );

    await publishSchema(
      /* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

        type Query {
          users: User
          admin: User
        }

        type User @key(fields: "id") {
          id: ID!
          pictureUrl: String @deprecated(reason: "no longer needed")
        }
      `,
      serviceBar,
    );

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        // foo
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.name',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        // bar
        expect.objectContaining({
          coordinate: 'Query.users',
          created_in_version_id: ver4,
          deprecated_in_version_id: null,
        }),
        expect.not.objectContaining({
          coordinate: 'Query.randomUser',
          created_in_version_id: ver5,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.admin',
          created_in_version_id: ver5,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.pictureUrl',
          created_in_version_id: ver4,
          deprecated_in_version_id: ver5,
        }),
      ]),
    );
  });

  test.concurrent('stitching', async ({ expect }) => {
    const { publishSchema, deleteSchema, target, createDbConnection } = await prepare(
      ProjectType.Stitching,
    );
    await using db = await createDbConnection();

    const serviceFoo = {
      name: 'foo',
      url: 'https://api.com/foo',
    };

    const serviceBar = {
      name: 'bar',
      url: 'https://api.com/bar',
    };

    const ver1 = await publishSchema(
      /* GraphQL */ `
        type Query {
          user(id: ID!): User @merge
        }

        type User @key(selectionSet: "{ id }") {
          id: ID!
          name: String
        }
      `,
      serviceFoo,
    );

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.name',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
      ]),
    );

    const ver2 = await publishSchema(
      /* GraphQL */ `
        type Query {
          users: User
          user(id: ID!): User @merge
        }

        type User @key(selectionSet: "{ id }") {
          id: ID!
          pictureUrl: String
        }
      `,
      serviceBar,
    );

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        // foo
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.name',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        // bar
        expect.objectContaining({
          coordinate: 'Query.users',
          created_in_version_id: ver2,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.pictureUrl',
          created_in_version_id: ver2,
          deprecated_in_version_id: null,
        }),
      ]),
    );

    await deleteSchema(serviceBar.name);

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        // foo
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.name',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        // bar
        expect.not.objectContaining({
          coordinate: 'Query.users',
          created_in_version_id: ver2,
          deprecated_in_version_id: null,
        }),
        expect.not.objectContaining({
          coordinate: 'User.pictureUrl',
          created_in_version_id: ver2,
          deprecated_in_version_id: null,
        }),
      ]),
    );

    const ver4 = await publishSchema(
      /* GraphQL */ `
        type Query {
          users: User
          user(id: ID!): User @merge
        }

        type User @key(selectionSet: "{ id }") {
          id: ID!
          pictureUrl: String
        }
      `,
      serviceBar,
    );

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        // foo
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.name',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        // bar
        expect.objectContaining({
          coordinate: 'Query.users',
          created_in_version_id: ver4,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.pictureUrl',
          created_in_version_id: ver4,
          deprecated_in_version_id: null,
        }),
      ]),
    );

    const ver5 = await publishSchema(
      /* GraphQL */ `
        type Query {
          users: User @deprecated(reason: "no longer needed")
          randomUser: User
          admin: User
          user(id: ID!): User @merge
        }

        type User @key(selectionSet: "{ id }") {
          id: ID!
          pictureUrl: String @deprecated(reason: "no longer needed")
        }
      `,
      serviceBar,
    );

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        // foo
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.name',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        // bar
        expect.objectContaining({
          coordinate: 'Query.users',
          created_in_version_id: ver4,
          deprecated_in_version_id: ver5,
        }),
        expect.objectContaining({
          coordinate: 'Query.randomUser',
          created_in_version_id: ver5,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.admin',
          created_in_version_id: ver5,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.pictureUrl',
          created_in_version_id: ver4,
          deprecated_in_version_id: ver5,
        }),
      ]),
    );

    await publishSchema(
      /* GraphQL */ `
        type Query {
          users: User
          admin: User
          user(id: ID!): User @merge
        }

        type User @key(selectionSet: "{ id }") {
          id: ID!
          pictureUrl: String @deprecated(reason: "no longer needed")
        }
      `,
      serviceBar,
    );

    await expect(fetchCoordinates(db.pool, target)).resolves.toEqual(
      expect.arrayContaining([
        // foo
        expect.objectContaining({
          coordinate: 'Query',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.user.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.id',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.name',
          created_in_version_id: ver1,
          deprecated_in_version_id: null,
        }),
        // bar
        expect.objectContaining({
          coordinate: 'Query.users',
          created_in_version_id: ver4,
          deprecated_in_version_id: null,
        }),
        expect.not.objectContaining({
          coordinate: 'Query.randomUser',
          created_in_version_id: ver5,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'Query.admin',
          created_in_version_id: ver5,
          deprecated_in_version_id: null,
        }),
        expect.objectContaining({
          coordinate: 'User.pictureUrl',
          created_in_version_id: ver4,
          deprecated_in_version_id: ver5,
        }),
      ]),
    );
  });
});

async function prepare(projectType: ProjectType = ProjectType.Single) {
  const { createOwner, createDbConnection } = initSeed();
  const { createOrg } = await createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken, project, target } = await createProject(projectType);
  const token = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    projectScopes: [],
    organizationScopes: [],
  });

  return {
    createDbConnection,
    async publishSchema(
      sdl: string,
      service?: {
        name: string;
        url: string;
      },
    ) {
      const result = await token
        .publishSchema({ sdl, service: service?.name, url: service?.url })
        .then(r => r.expectNoGraphQLErrors());

      if (result.schemaPublish.__typename !== 'SchemaPublishSuccess') {
        console.log(JSON.stringify(result.schemaPublish, null, 2));
        throw new Error(`Expected schemaPublish success, got ${result.schemaPublish.__typename}`);
      }

      if (!result.schemaPublish.valid) {
        throw new Error('Expected schema to be valid');
      }

      const version = await token.fetchLatestValidSchema();
      const versionId = version.latestValidVersion?.id;

      if (!versionId) {
        throw new Error('Expected version id to be defined');
      }

      return versionId;
    },
    async deleteSchema(serviceName: string) {
      const result = await token.deleteSchema(serviceName).then(r => r.expectNoGraphQLErrors());

      if (result.schemaDelete.__typename !== 'SchemaDeleteSuccess') {
        throw new Error(`Expected schemaDelete success, got ${result.schemaDelete.__typename}`);
      }

      if (!result.schemaDelete.valid) {
        throw new Error('Expected schema to be valid');
      }

      const version = await token.fetchLatestValidSchema();
      const versionId = version.latestValidVersion?.id;

      if (!versionId) {
        throw new Error('Expected version id to be defined');
      }

      return versionId;
    },
    organization,
    project,
    target,
  };
}
