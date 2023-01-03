/* eslint-disable no-process-env */
import { ProjectType, TargetAccessScope } from '@app/gql/graphql';
import { fetch } from '@whatwg-node/fetch';
import { createTarget, publishSchema } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';

test.concurrent('cannot publish a schema without target:registry:write access', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Federation);
  const readToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead],
    projectScopes: [],
    organizationScopes: [],
  });

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
  const readWriteToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    projectScopes: [],
    organizationScopes: [],
  });

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
  const readWriteToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    projectScopes: [],
    organizationScopes: [],
  });

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
  expect(latestResult.latestVersion?.schemas.total).toBe(1);

  const firstNode = latestResult.latestVersion?.schemas.nodes[0];

  expect(firstNode).toEqual(
    expect.objectContaining({
      commit: '2',
      source: expect.stringContaining('type Query { ping: String @auth pong: String }'),
    }),
  );
  expect(firstNode).not.toEqual(
    expect.objectContaining({
      source: expect.stringContaining('directive'),
    }),
  );

  expect(latestResult.latestVersion?.baseSchema).toMatch(
    'directive @auth on OBJECT | FIELD_DEFINITION',
  );
});

test.concurrent.each(['legacy', 'modern'])(
  'directives should not be removed (federation %s)',
  async mode => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Federation, {
      useLegacyRegistryModels: mode === 'legacy',
    });
    const readWriteToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
    });

    // Publish schema with write rights
    const publishResult = await readWriteToken
      .publishSchema({
        commit: 'abc123',
        service: 'users',
        url: 'https://api.com/users',
        sdl: `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`,
      })
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
    const versionsResult = await readWriteToken.fetchVersions(5);
    expect(versionsResult).toHaveLength(1);

    const latestResult = await readWriteToken.latestSchema();
    expect(latestResult.latestVersion?.schemas.total).toBe(1);

    expect(latestResult.latestVersion?.schemas.nodes[0]).toEqual(
      expect.objectContaining({
        commit: 'abc123',
        source: expect.stringContaining(
          `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`,
        ),
      }),
    );
  },
);

test.concurrent.each(['legacy', 'modern'])(
  'directives should not be removed (stitching %s)',
  async mode => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Stitching, {
      useLegacyRegistryModels: mode === 'legacy',
    });
    const readWriteToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
    });

    // Publish schema with write rights
    const publishResult = await readWriteToken
      .publishSchema({
        author: 'Kamil',
        sdl: `type Query { me: User } type User @key(selectionSet: "{ id }") { id: ID! name: String }`,
        service: 'test',
        url: 'https://api.com/users',
        commit: 'abc123',
      })
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const versionsResult = await readWriteToken.fetchVersions(5);
    expect(versionsResult).toHaveLength(1);

    const latestResult = await readWriteToken.latestSchema();
    expect(latestResult.latestVersion?.schemas.total).toBe(1);

    expect(latestResult.latestVersion?.schemas.nodes[0]).toEqual(
      expect.objectContaining({
        commit: 'abc123',
        source: expect.stringContaining(
          `type Query { me: User } type User @key(selectionSet: "{ id }") { id: ID! name: String }`,
        ),
      }),
    );
  },
);

test.concurrent.each(['legacy', 'modern'])(
  'directives should not be removed (single %s)',
  async mode => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Single, {
      useLegacyRegistryModels: mode === 'legacy',
    });
    const readWriteToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
    });
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
    expect(latestResult.latestVersion?.schemas.total).toBe(1);

    const firstNode = latestResult.latestVersion?.schemas.nodes[0];
    if (firstNode?.__typename === 'DeletedCompositeSchema') {
      throw new Error('Unexpected deleted schema');
    }

    expect(latestResult.latestVersion?.schemas.nodes[0]).toEqual(
      expect.objectContaining({
        commit: 'abc123',
        source: expect.stringContaining(
          `directive @auth on FIELD_DEFINITION type Query { me: User @auth } type User { id: ID! name: String }`,
        ),
      }),
    );
  },
);

test.concurrent('share publication of schema using redis', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);
  const readWriteToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    projectScopes: [],
    organizationScopes: [],
  });

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

test.concurrent('CDN data can not be fetched with an invalid access token', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);
  const readWriteToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    projectScopes: [],
    organizationScopes: [],
  });

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
  const readWriteToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    projectScopes: [],
    organizationScopes: [],
  });

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
  'should publish only one schema if multiple same publishes are started in parallel',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Single);
    const readWriteToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
    });

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

describe.each`
  projectType               | model
  ${ProjectType.Single}     | ${'modern'}
  ${ProjectType.Stitching}  | ${'modern'}
  ${ProjectType.Federation} | ${'modern'}
  ${ProjectType.Single}     | ${'legacy'}
  ${ProjectType.Stitching}  | ${'legacy'}
  ${ProjectType.Federation} | ${'legacy'}
`('$projectType ($model)', ({ projectType, model }) => {
  const serviceName =
    projectType === ProjectType.Single
      ? {}
      : {
          service: 'test',
        };
  const serviceUrl = projectType === ProjectType.Single ? {} : { url: 'http://localhost:4000' };

  test.concurrent('linkToWebsite should be available when publishing initial schema', async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { project, target, createToken } = await createProject(projectType, {
      useLegacyRegistryModels: model === 'legacy',
    });
    const readWriteToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
    });

    const result = await readWriteToken
      .publishSchema({
        author: 'Kamil',
        commit: 'abc123',
        sdl: `type Query { ping: String }`,
        ...serviceName,
        ...serviceUrl,
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
      const { createToken, project, target } = await createProject(projectType, {
        useLegacyRegistryModels: model === 'legacy',
      });
      const readWriteToken = await createToken({
        targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
        projectScopes: [],
        organizationScopes: [],
      });

      let result = await readWriteToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String }`,
          ...serviceName,
          ...serviceUrl,
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

      result = await readWriteToken
        .publishSchema({
          author: 'Kamil',
          commit: 'abc123',
          sdl: `type Query { ping: String pong: String }`,
          ...serviceName,
          ...serviceUrl,
          force: true,
          experimental_acceptBreakingChanges: true,
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

  test("Two targets with the same commit id shouldn't return an error", async () => {
    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { organization, createProject } = await createOrg();
    const { project, createToken } = await createProject(projectType, {
      useLegacyRegistryModels: model === 'legacy',
    });
    const readWriteToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
    });

    const publishResult = await readWriteToken
      .publishSchema({
        author: 'gilad',
        commit: 'abc123',
        sdl: `type Query { ping: String }`,
        ...serviceName,
        ...serviceUrl,
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
    const writeTokenResult2 = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
      targetId: target2.cleanId,
    });
    const publishResult2 = await writeTokenResult2
      .publishSchema({
        author: 'gilad',
        commit: 'abc123',
        sdl: `type Query { ping: String }`,
        ...serviceName,
        ...serviceUrl,
      })
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
    expect(publishResult2.schemaPublish.__typename).toBe('SchemaPublishSuccess');
  });
});
