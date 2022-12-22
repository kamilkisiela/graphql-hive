/* eslint-disable no-process-env */
import { TargetAccessScope, ProjectType } from '@app/gql/graphql';
import { createTarget, publishSchema } from '../../../testkit/flow';
import { fetch } from '@whatwg-node/fetch';
import { initSeed } from '../../../testkit/seed';

test.concurrent('cannot publish a schema without target:registry:write access', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Federation);
  const readToken = await createToken([TargetAccessScope.RegistryRead], [], []);

  const resultErrors = await readToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping: String
        }
      `,
    })
    .then(r => r.expectGraphQLErrors());

  expect(resultErrors).toHaveLength(1);
  expect(resultErrors[0].message).toMatch('target:registry:write');
});

test.concurrent('can publish a schema with target:registry:write access', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);
  const readWriteToken = await createToken(
    [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    [],
    [],
  );

  const result1 = await readWriteToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping: String
        }
      `,
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(result1.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const result2 = await readWriteToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping: String
          pong: String
        }
      `,
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(result2.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const versionsResult = await readWriteToken.fetchVersions(3);
  expect(versionsResult).toHaveLength(2);
});

test.concurrent('base schema should not affect the output schema persisted in db', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);
  const readWriteToken = await createToken(
    [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    [],
    [],
  );

  // Publish schema with write rights
  const publishResult = await readWriteToken
    .publishSchema({
      commit: '1',
      sdl: `type Query { ping: String }`,
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be successful
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  await readWriteToken.updateBaseSchema(`
    directive @auth on OBJECT | FIELD_DEFINITION
  `);

  const extendedPublishResult = await readWriteToken
    .publishSchema({
      commit: '2',
      sdl: `type Query { ping: String @auth pong: String }`,
    })
    .then(r => r.expectNoGraphQLErrors());
  expect(extendedPublishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const versionsResult = await readWriteToken.fetchVersions(5);
  expect(versionsResult).toHaveLength(2);

  const latestResult = await readWriteToken.latestSchema();
  expect(latestResult.latestVersion.schemas.total).toBe(1);
  expect(latestResult.latestVersion.schemas.nodes[0].commit).toBe('2');
  expect(latestResult.latestVersion.schemas.nodes[0].source).toMatch(
    'type Query { ping: String @auth pong: String }',
  );
  expect(latestResult.latestVersion.schemas.nodes[0].source).not.toMatch('directive');
  expect(latestResult.latestVersion.baseSchema).toMatch(
    'directive @auth on OBJECT | FIELD_DEFINITION',
  );
});

test.concurrent('directives should not be removed (federation)', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Federation);
  const readWriteToken = await createToken(
    [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    [],
    [],
  );

  // Publish schema with write rights
  const publishResult = await readWriteToken
    .publishSchema({
      commit: 'abc123',
      url: 'https://api.com/users',
      service: 'users',
      sdl: `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`,
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be successful
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
  const versionsResult = await readWriteToken.fetchVersions(5);
  expect(versionsResult).toHaveLength(1);

  const latestResult = await readWriteToken.latestSchema();
  expect(latestResult.latestVersion.schemas.total).toBe(1);
  expect(latestResult.latestVersion.schemas.nodes[0].commit).toBe('abc123');
  expect(latestResult.latestVersion.schemas.nodes[0].source).toMatch(
    `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`,
  );
});

test.concurrent(
  'should allow to update the URL of a Federated service without changing the schema',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Federation);
    const readWriteToken = await createToken(
      [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      [],
      [],
    );

    const basePublishParams = {
      service: 'test',
      commit: 'abc123',
      url: 'https://api.com/users',
      sdl: `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`,
    };

    const publishResult = await readWriteToken
      .publishSchema(basePublishParams)
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const versionsResult = await readWriteToken.fetchVersions(5);
    expect(versionsResult).toHaveLength(1);

    // try to update the schema again, with force and url set
    const updateResult = await readWriteToken
      .publishSchema({
        ...basePublishParams,
        url: `http://localhost:3000/test/graphql`,
        commit: 'abc1234',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(updateResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
    expect((updateResult.schemaPublish as any).message).toBe(
      'Updated: New service url: http://localhost:3000/test/graphql (previously: https://api.com/users)',
    );

    const latestResult = await readWriteToken.latestSchema();
    expect(latestResult.latestVersion.schemas.total).toBe(1);
    expect(latestResult.latestVersion.schemas.nodes[0].commit).toBe('abc1234');
    expect(latestResult.latestVersion.schemas.nodes[0].url).toBe(
      'http://localhost:3000/test/graphql',
    );
    expect(latestResult.latestVersion.schemas.nodes[0].source).toMatch(
      `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`,
    );
  },
);

test.concurrent(
  'should allow to update the URL of a Federated service while also changing the schema',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Federation);
    const readWriteToken = await createToken(
      [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      [],
      [],
    );

    const basePublishParams = {
      service: 'test',
      commit: 'abc123',
      url: 'https://api.com/users',
      sdl: `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`,
    };

    const publishResult = await readWriteToken
      .publishSchema(basePublishParams)
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const versionsResult = await readWriteToken.fetchVersions(5);
    expect(versionsResult).toHaveLength(1);

    const latestResult = await readWriteToken.latestSchema();
    expect(latestResult.latestVersion.schemas.total).toBe(1);
    expect(latestResult.latestVersion.schemas.nodes[0].commit).toBe('abc123');
    expect(latestResult.latestVersion.schemas.nodes[0].source).toMatch(
      `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`,
    );

    // try to update the schema again, with force and url set
    const updateResult = await readWriteToken
      .publishSchema({
        ...basePublishParams,
        force: true,
        url: `http://localhost:3000/test/graphql`,
        // here, we also add something minor to the schema, just to trigger the publish flow and not just the URL update flow
        sdl: `type Query { me: User } type User @key(fields: "id") { id: ID! name: String age: Int }`,
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(updateResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
  },
);

test.concurrent('directives should not be removed (stitching)', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Stitching);
  const readWriteToken = await createToken(
    [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    [],
    [],
  );

  // Publish schema with write rights
  const publishResult = await readWriteToken
    .publishSchema({
      author: 'Kamil',
      sdl: `type Query { me: User } type User @key(selectionSet: "{ id }") { id: ID! name: String }`,
      service: 'test',
      commit: 'abc123',
      url: 'https://api.com/users',
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be successful
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const versionsResult = await readWriteToken.fetchVersions(5);
  expect(versionsResult).toHaveLength(1);

  const latestResult = await readWriteToken.latestSchema();
  expect(latestResult.latestVersion.schemas.total).toBe(1);
  expect(latestResult.latestVersion.schemas.nodes[0].commit).toBe('abc123');
  expect(latestResult.latestVersion.schemas.nodes[0].source).toMatch(
    `type Query { me: User } type User @key(selectionSet: "{ id }") { id: ID! name: String }`,
  );
});

test.concurrent('directives should not be removed (single)', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);
  const readWriteToken = await createToken(
    [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    [],
    [],
  );
  // Publish schema with write rights
  const publishResult = await readWriteToken
    .publishSchema({
      author: 'Kamil',
      commit: 'abc123',
      sdl: `directive @auth on FIELD_DEFINITION type Query { me: User @auth } type User { id: ID! name: String }`,
      service: 'test',
      url: 'https://api.com/users',
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be successful
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const versionsResult = await readWriteToken.fetchVersions(5);
  expect(versionsResult).toHaveLength(1);

  const latestResult = await readWriteToken.latestSchema();
  expect(latestResult.latestVersion.schemas.total).toBe(1);
  expect(latestResult.latestVersion.schemas.nodes[0].commit).toBe('abc123');
  expect(latestResult.latestVersion.schemas.nodes[0].source).toMatch(
    `directive @auth on FIELD_DEFINITION type Query { me: User @auth } type User { id: ID! name: String }`,
  );
});

test.concurrent('share publication of schema using redis', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);
  const readWriteToken = await createToken(
    [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    [],
    [],
  );

  // Publish schema with write rights
  const publishResult = await readWriteToken
    .publishSchema({
      author: 'Kamil',
      commit: 'abc123',
      sdl: `type Query { ping: String }`,
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be successful
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const [publishResult1, publishResult2] = await Promise.all([
    readWriteToken
      .publishSchema({
        sdl: `type Query { ping: String pong: String }`,
        author: 'Kamil',
        commit: 'abc234',
      })
      .then(r => r.expectNoGraphQLErrors()),
    readWriteToken
      .publishSchema({
        sdl: `type Query { ping: String pong: String }`,
        author: 'Kamil',
        commit: 'abc234',
      })
      .then(r => r.expectNoGraphQLErrors()),
  ]);
  expect(publishResult1.schemaPublish.__typename).toBe('SchemaPublishSuccess');
  expect(publishResult2.schemaPublish.__typename).toBe('SchemaPublishSuccess');
});

test("Two targets with the same commit id shouldn't return an error", async () => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { organization, createProject } = await createOrg();
  const { project, createToken } = await createProject(ProjectType.Single);
  const readWriteToken = await createToken(
    [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    [],
    [],
  );

  const publishResult = await readWriteToken
    .publishSchema({
      author: 'gilad',
      commit: 'abc123',
      sdl: `type Query { ping: String }`,
    })
    .then(r => r.expectNoGraphQLErrors());
  const createTargetResult = await createTarget(
    {
      organization: organization.cleanId,
      project: project.cleanId,
      name: 'target2',
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());
  const target2 = createTargetResult.createTarget.ok!.createdTarget;
  const writeTokenResult2 = await createToken(
    [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    [],
    [],
    target2.cleanId,
  );
  const publishResult2 = await writeTokenResult2
    .publishSchema({
      author: 'gilad',
      commit: 'abc123',
      sdl: `type Query { ping: String }`,
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be successful
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
  expect(publishResult2.schemaPublish.__typename).toBe('SchemaPublishSuccess');
});

test.concurrent('marking versions as valid', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);
  const readWriteToken = await createToken(
    [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    [],
    [],
  );

  // Initial schema
  let result = await readWriteToken
    .publishSchema({
      author: 'Kamil',
      commit: 'c0',
      sdl: `type Query { ping: String }`,
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // Second version with a forced breaking change
  result = await readWriteToken
    .publishSchema({
      author: 'Kamil',
      commit: 'c1',
      sdl: `type Query { pong: String }`,
      force: true,
      metadata: JSON.stringify({ c1: true }),
    })
    .then(r => r.expectNoGraphQLErrors());

  // third version with another forced breaking change
  result = await readWriteToken
    .publishSchema({
      author: 'Kamil',
      commit: 'c2',
      sdl: `type Query { tennis: String }`,
      force: true,
      metadata: JSON.stringify({ c2: true }),
    })
    .then(r => r.expectNoGraphQLErrors());

  const versionsResult = await readWriteToken.fetchVersions(3);

  expect(versionsResult).toHaveLength(3);

  // the initial version should be the latest valid version
  let latestValidSchemaResult = await readWriteToken.fetchLatestValidSchema();
  expect(latestValidSchemaResult.latestValidVersion.schemas.total).toEqual(1);
  expect(latestValidSchemaResult.latestValidVersion.schemas.nodes[0].commit).toEqual('c0');

  const versionId = (commit: string) =>
    versionsResult.find(node => node.commit.commit === commit)!.id;

  // marking the third version as valid should promote it to be the latest valid version
  let versionStatusUpdateResult = await readWriteToken.updateSchemaVersionStatus(
    versionId('c2'),
    true,
  );

  expect(versionStatusUpdateResult.updateSchemaVersionStatus.id).toEqual(versionId('c2'));

  latestValidSchemaResult = await readWriteToken.fetchLatestValidSchema();
  expect(latestValidSchemaResult.latestValidVersion.id).toEqual(versionId('c2'));

  // marking the second (not the most recent) version as valid should NOT promote it to be the latest valid version
  versionStatusUpdateResult = await readWriteToken.updateSchemaVersionStatus(versionId('c1'), true);

  latestValidSchemaResult = await readWriteToken.fetchLatestValidSchema();
  expect(latestValidSchemaResult.latestValidVersion.id).toEqual(versionId('c2'));
});

test.concurrent(
  'marking only the most recent version as valid result in an update of CDN',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Single);
    const readWriteToken = await createToken(
      [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      [],
      [],
    );

    // Initial schema
    let result = await readWriteToken
      .publishSchema({
        author: 'Kamil',
        commit: 'c0',
        sdl: `type Query { ping: String }`,
        metadata: JSON.stringify({ c0: 1 }),
      })
      .then(e => e.expectNoGraphQLErrors());

    expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // Second version with a forced breaking change
    result = await readWriteToken
      .publishSchema({
        author: 'Kamil',
        commit: 'c1',
        sdl: `type Query { pong: String }`,
        force: true,
        metadata: JSON.stringify({ c1: 1 }),
      })
      .then(e => e.expectNoGraphQLErrors());

    // third version with another forced breaking change
    result = await readWriteToken
      .publishSchema({
        author: 'Kamil',
        commit: 'c2',
        sdl: `type Query { tennis: String }`,
        force: true,
        metadata: JSON.stringify({ c2: 1 }),
      })
      .then(e => e.expectNoGraphQLErrors());

    // the initial version should available on CDN
    let cdnResult = await readWriteToken.fetchSchemaFromCDN();
    expect(cdnResult.body).toContain('ping');

    let cdnMetadataResult = await readWriteToken.fetchMetadataFromCDN();
    expect(cdnMetadataResult.status).toEqual(200);
    expect(cdnMetadataResult.body).toEqual([{ c0: 1 }]);

    const versionsResult = await readWriteToken.fetchVersions(3);

    const versionId = (commit: string) =>
      versionsResult.find(node => node.commit.commit === commit)!.id;

    // marking the third version as valid should promote it to be the latest valid version and publish it to CDN
    await readWriteToken.updateSchemaVersionStatus(versionId('c2'), true);

    cdnResult = await readWriteToken.fetchSchemaFromCDN();
    expect(cdnResult.body).toContain('tennis');

    cdnMetadataResult = await readWriteToken.fetchMetadataFromCDN();
    expect(cdnMetadataResult.status).toEqual(200);
    expect(cdnMetadataResult.body).toEqual([{ c2: 1 }]);

    // marking the second (not the most recent) version as valid should NOT promote it to be the latest valid version
    await readWriteToken.updateSchemaVersionStatus(versionId('c1'), true);

    cdnResult = await readWriteToken.fetchSchemaFromCDN();
    expect(cdnResult.body).toContain('tennis');

    cdnMetadataResult = await readWriteToken.fetchMetadataFromCDN();
    expect(cdnMetadataResult.status).toEqual(200);
    expect(cdnMetadataResult.body).toEqual([{ c2: 1 }]);
  },
);

test.concurrent('CDN data can not be fetched with an invalid access token', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);
  const readWriteToken = await createToken(
    [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    [],
    [],
  );

  // Initial schema
  const result = await readWriteToken
    .publishSchema({
      author: 'Kamil',
      commit: 'c0',
      sdl: `type Query { ping: String }`,
      metadata: JSON.stringify({ c0: 1 }),
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const cdn = await readWriteToken.createCdnAccess();
  const res = await fetch(cdn.url + '/sdl', {
    method: 'GET',
    headers: {
      'X-Hive-CDN-Key': 'i-like-turtles',
    },
  });

  expect(res.status).toEqual(403);
});

test.concurrent('CDN data can be fetched with an valid access token', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);
  const readWriteToken = await createToken(
    [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    [],
    [],
  );

  // Initial schema
  const result = await readWriteToken
    .publishSchema({
      author: 'Kamil',
      commit: 'c0',
      sdl: `type Query { ping: String }`,
      metadata: JSON.stringify({ c0: 1 }),
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const cdn = await readWriteToken.createCdnAccess();
  const artifactUrl = cdn.url + '/sdl';

  const cdnResult = await fetch(artifactUrl, {
    method: 'GET',
    headers: {
      'X-Hive-CDN-Key': cdn.token,
    },
  });

  expect(cdnResult.status).toEqual(200);
});

test.concurrent('linkToWebsite should be available when publishing initial schema', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { project, target, createToken } = await createProject(ProjectType.Single);
  const readWriteToken = await createToken(
    [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    [],
    [],
  );

  const result = await readWriteToken
    .publishSchema({
      author: 'Kamil',
      commit: 'abc123',
      sdl: `type Query { ping: String }`,
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const linkToWebsite =
    result.schemaPublish.__typename === 'SchemaPublishSuccess'
      ? result.schemaPublish.linkToWebsite
      : null;

  expect(linkToWebsite).toEqual(
    `${process.env.HIVE_APP_BASE_URL}/${organization.cleanId}/${project.cleanId}/${target.cleanId}`,
  );
});

test.concurrent(
  'linkToWebsite should be available when publishing non-initial schema',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createToken, project, target } = await createProject(ProjectType.Single);
    const readWriteToken = await createToken(
      [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      [],
      [],
    );

    let result = await readWriteToken
      .publishSchema({
        author: 'Kamil',
        commit: 'abc123',
        sdl: `type Query { ping: String }`,
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    result = await readWriteToken
      .publishSchema({
        author: 'Kamil',
        commit: 'abc123',
        sdl: `type Query { ping: String pong: String }`,
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const linkToWebsite =
      result.schemaPublish.__typename === 'SchemaPublishSuccess'
        ? result.schemaPublish.linkToWebsite
        : null;

    expect(linkToWebsite).toMatch(
      `${process.env.HIVE_APP_BASE_URL}/${organization.cleanId}/${project.cleanId}/${target.cleanId}/history/`,
    );
    expect(linkToWebsite).toMatch(/history\/[a-z0-9-]+$/);
  },
);

test.concurrent('cannot do API request with invalid access token', async () => {
  const errors = await publishSchema(
    {
      commit: '1',
      sdl: 'type Query { smokeBangBang: String }',
      author: 'Kamil',
    },
    'foobars',
  ).then(r => r.expectGraphQLErrors());

  expect(errors).toEqual([
    {
      message: 'Invalid token provided!',
      locations: [
        {
          column: 3,
          line: 2,
        },
      ],
      path: ['schemaPublish'],
    },
  ]);
});

test.concurrent(
  'publish new schema when a field is moved from one service to another (stitching)',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Stitching);
    const readWriteToken = await createToken(
      [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      [],
      [],
    );

    // cats service has only one field
    let result = await readWriteToken
      .publishSchema({
        author: 'Kamil',
        commit: 'cats',
        sdl: /* GraphQL */ `
          type Query {
            randomCat: String
          }
        `,
        service: 'cats',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // dogs service has two fields
    result = await readWriteToken
      .publishSchema({
        author: 'Kamil',
        commit: 'dogs',
        sdl: /* GraphQL */ `
          type Query {
            randomDog: String
            randomAnimal: String
          }
        `,
        service: 'dogs',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // cats service has now two fields, randomAnimal is borrowed from dogs service
    result = await readWriteToken
      .publishSchema({
        author: 'Kamil',
        commit: 'animals',
        sdl: /* GraphQL */ `
          type Query {
            randomCat: String
            randomAnimal: String
          }
        `,
        service: 'cats',
      })
      .then(r => r.expectNoGraphQLErrors());

    // We expect to have a new version, even tough the schema (merged) is the same
    expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const versionsResult = await readWriteToken.fetchVersions(3);
    expect(versionsResult).toHaveLength(3);
  },
);

test.concurrent(
  '(experimental_acceptBreakingChanges) accept breaking changes if schema is composable',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Federation);
    const readWriteToken = await createToken(
      [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      [],
      [],
    );

    const basePublishParams = {
      service: 'test',
      author: 'Kamil',
      commit: 'init',
      url: 'https://api.com/users',
      sdl: `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`,
    };

    const publishResult = await readWriteToken
      .publishSchema(basePublishParams)
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // Publish a new version that makes the schema composable but includes a breaking change
    const composableButBreakingResult = await readWriteToken
      .publishSchema({
        ...basePublishParams,
        commit: 'composable-but-breaking',
        force: true,
        experimental_acceptBreakingChanges: true,
        // We changed the `@key(fields: "age")` to `@key(fields: "id")`
        // We also removed the `name` field (breaking)
        sdl: `type Query { me: User } type User @key(fields: "id") { id: ID! }`,
      })
      .then(r => r.expectNoGraphQLErrors());

    const latestValid = await readWriteToken.fetchLatestValidSchema();

    expect(composableButBreakingResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
    expect(latestValid.latestValidVersion.schemas.nodes[0].commit).toBe('composable-but-breaking');
  },
);

test.concurrent(
  '(experimental_acceptBreakingChanges and force) publishing composable schema on second attempt',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Federation);
    const readWriteToken = await createToken(
      [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      [],
      [],
    );

    await readWriteToken.publishSchema({
      service: 'reviews',
      author: 'Kamil',
      commit: 'reviews',
      url: 'https://api.com/reviews',
      experimental_acceptBreakingChanges: true,
      force: true,
      sdl: /* GraphQL */ `
        extend type Product @key(fields: "id") {
          id: ID! @external
          reviews: [Review]
          reviewSummary: ReviewSummary
        }

        type Review @key(fields: "id") {
          id: ID!
          rating: Float
        }

        type ReviewSummary {
          totalReviews: Int
        }
      `,
    });

    await readWriteToken.publishSchema({
      service: 'products',
      author: 'Kamil',
      commit: 'products',
      url: 'https://api.com/products',
      experimental_acceptBreakingChanges: true,
      force: true,
      sdl: /* GraphQL */ `
        enum CURRENCY_CODE {
          USD
        }

        type Department {
          category: ProductCategory
          url: String
        }

        type Money {
          amount: Float
          currencyCode: CURRENCY_CODE
        }

        type Price {
          cost: Money
          deal: Float
          dealSavings: Money
        }

        type Product @key(fields: "id") {
          id: ID!
          title: String
          url: String
          description: String
          price: Price
          salesRank(category: ProductCategory = ALL): Int
          salesRankOverall: Int
          salesRankInCategory: Int
          category: ProductCategory
          images(size: Int = 1000): [String]
          primaryImage(size: Int = 1000): String
        }

        enum ProductCategory {
          ALL
          GIFT_CARDS
          ELECTRONICS
          CAMERA_N_PHOTO
          VIDEO_GAMES
          BOOKS
          CLOTHING
        }

        extend type Query {
          categories: [Department]
          product(id: ID!): Product
        }
      `,
    });

    const latestValid = await readWriteToken.fetchLatestValidSchema();
    expect(latestValid.latestValidVersion.schemas.nodes[0].commit).toBe('products');
  },
);

test.concurrent(
  'publishing composable schema without the definition of the Query type, but only extension, should work',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Federation);
    const readWriteToken = await createToken(
      [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      [],
      [],
    );

    await readWriteToken.publishSchema({
      service: 'products',
      author: 'Kamil',
      commit: 'products',
      url: 'https://api.com/products',
      experimental_acceptBreakingChanges: true,
      force: true,
      sdl: /* GraphQL */ `
        type Product @key(fields: "id") {
          id: ID!
          title: String
          url: String
        }

        extend type Query {
          product(id: ID!): Product
        }
      `,
    });

    await readWriteToken.publishSchema({
      service: 'users',
      author: 'Kamil',
      commit: 'users',
      url: 'https://api.com/users',
      experimental_acceptBreakingChanges: true,
      force: true,
      sdl: /* GraphQL */ `
        type User @key(fields: "id") {
          id: ID!
          name: String!
        }

        extend type Query {
          user(id: ID!): User
        }
      `,
    });

    const latestValid = await readWriteToken.fetchLatestValidSchema();
    expect(latestValid.latestValidVersion.schemas.nodes[0].commit).toBe('users');
  },
);

test.concurrent(
  'should publish only one schema if multiple same publishes are started in parallel',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Single);
    const readWriteToken = await createToken(
      [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      [],
      [],
    );

    const commits = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
    const publishes = await Promise.all(
      commits.map(commit =>
        readWriteToken
          .publishSchema({
            author: 'John',
            commit,
            sdl: 'type Query { ping: String }',
          })
          .then(r => r.expectNoGraphQLErrors()),
      ),
    );
    expect(
      publishes.every(({ schemaPublish }) => schemaPublish.__typename === 'SchemaPublishSuccess'),
    ).toBeTruthy();

    const versionsResult = await readWriteToken.fetchVersions(commits.length);
    expect(versionsResult.length).toBe(1); // all publishes have same schema
  },
);
