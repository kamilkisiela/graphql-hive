import 'reflect-metadata';
import { graphql } from 'testkit/gql';
import { execute } from 'testkit/graphql';

/* eslint-disable no-process-env */
import { ProjectAccessScope, ProjectType, TargetAccessScope } from '@app/gql/graphql';
// eslint-disable-next-line import/no-extraneous-dependencies
import { createStorage } from '@hive/storage';
import { fetch } from '@whatwg-node/fetch';
import {
  createTarget,
  enableExternalSchemaComposition,
  publishSchema,
} from '../../../testkit/flow';
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
  const { createToken } = await createProject(ProjectType.Federation);
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
      service: 'ping',
      url: 'https://api.com/ping',
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be successful
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  await expect(readWriteToken.fetchVersions(2)).resolves.toHaveLength(1);

  const [publishResult1, publishResult2] = await Promise.all([
    readWriteToken
      .publishSchema({
        sdl: `type Query { ping: String pong: String }`,
        author: 'Kamil',
        commit: 'abc234',
        service: 'ping', // case insensitive
        url: 'https://api.com/ping',
      })
      .then(r => r.expectNoGraphQLErrors()),
    readWriteToken
      .publishSchema({
        sdl: `type Query { ping: String pong: String }`,
        author: 'Kamil',
        commit: 'abc234',
        service: 'PiNg', // case insensitive
        url: 'https://api.com/ping',
      })
      .then(r => r.expectNoGraphQLErrors()),
  ]);
  expect(publishResult1.schemaPublish.__typename).toBe('SchemaPublishSuccess');
  expect(publishResult2.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  await expect(readWriteToken.fetchVersions(3)).resolves.toHaveLength(2);
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
  const res = await fetch(cdn.cdnUrl + '/sdl', {
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
  const artifactUrl = cdn.cdnUrl + '/sdl';

  const cdnResult = await fetch(artifactUrl, {
    method: 'GET',
    headers: {
      'X-Hive-CDN-Key': cdn.secretAccessToken,
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
      message: 'Invalid token provided',
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

type EachParams = { projectType: ProjectType; model: 'modern' | 'legacy' };

describe.each`
  projectType               | model
  ${ProjectType.Single}     | ${'modern'}
  ${ProjectType.Stitching}  | ${'modern'}
  ${ProjectType.Federation} | ${'modern'}
  ${ProjectType.Single}     | ${'legacy'}
  ${ProjectType.Stitching}  | ${'legacy'}
  ${ProjectType.Federation} | ${'legacy'}
`('$projectType ($model)', ({ projectType, model }: EachParams) => {
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
          sdl: `type Query { ping: String }`,
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

const {
  POSTGRES_USER = 'postgres',
  POSTGRES_PASSWORD = 'postgres',
  POSTGRES_HOST = 'localhost',
  POSTGRES_PORT = 5432,
  POSTGRES_DB = 'registry',
  POSTGRES_SSL = null,
  POSTGRES_CONNECTION_STRING = null,
} = process.env;

function connectionString(dbName = POSTGRES_DB) {
  return (
    POSTGRES_CONNECTION_STRING ||
    `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${dbName}${
      POSTGRES_SSL ? '?sslmode=require' : '?sslmode=disable'
    }`
  );
}
type Awaited<T> = T extends PromiseLike<infer U> ? U : T;

describe('schema publishing changes are persisted', () => {
  let storage: Awaited<ReturnType<typeof createStorage>>;
  beforeAll(async () => {
    storage = await createStorage(connectionString(), 1);
  });
  afterAll(async () => {
    await storage.destroy();
  });

  function persistedTest(args: {
    name: string;
    schemaBefore: string;
    schemaAfter: string;
    equalsObject: object;
  }) {
    test.concurrent(`[Schema change] ${args.name}`, async () => {
      const serviceName = {
        service: 'test',
      };

      const serviceUrl = { url: 'http://localhost:4000' };

      const { createOrg } = await initSeed().createOwner();
      const { createProject, organization } = await createOrg();
      const { createToken, target, project } = await createProject(ProjectType.Federation, {});
      const readWriteToken = await createToken({
        targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
        projectScopes: [],
        organizationScopes: [],
      });

      const publishResult = await readWriteToken
        .publishSchema({
          author: 'gilad',
          commit: '123',
          sdl: args.schemaBefore,
          ...serviceName,
          ...serviceUrl,
        })
        .then(r => r.expectNoGraphQLErrors());
      expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

      const publishResult2 = await readWriteToken
        .publishSchema({
          force: true,
          author: 'gilad',
          commit: '456',
          sdl: args.schemaAfter,
          ...serviceName,
          ...serviceUrl,
        })
        .then(r => r.expectNoGraphQLErrors());

      if (publishResult2.schemaPublish.__typename !== 'SchemaPublishSuccess') {
        expect(publishResult2.schemaPublish.__typename).toBe('SchemaPublishSuccess');
        return;
      }

      const latestVersion = await storage.getLatestVersion({
        target: target.id,
        project: project.id,
        organization: organization.id,
      });

      const changes = await storage.getSchemaChangesForVersion({
        versionId: latestVersion.id,
      });

      expect(changes[0]).toEqual(args.equalsObject);
    });
  }

  persistedTest({
    name: 'FieldArgumentDescriptionChanged (description removed)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(
          """
          oi
          """
          a: Int
        ): String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        fieldName: 'ping',
        argumentName: 'a',
        oldDescription: 'oi',
        newDescription: null,
      },
      type: 'FIELD_ARGUMENT_DESCRIPTION_CHANGED',
    },
  });

  persistedTest({
    name: 'FieldArgumentDescriptionChanged (description added)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(
          """
          oi
          """
          a: Int
        ): String
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        fieldName: 'ping',
        argumentName: 'a',
        oldDescription: null,
        newDescription: 'oi',
      },
      type: 'FIELD_ARGUMENT_DESCRIPTION_CHANGED',
    },
  });

  persistedTest({
    name: 'FieldArgumentDefaultChangedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int = 1): String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int = 2): String
      }
    `,
    equalsObject: {
      meta: {
        argumentName: 'a',
        fieldName: 'ping',
        newDefaultValue: '2',
        oldDefaultValue: '1',
        typeName: 'Query',
      },
      type: 'FIELD_ARGUMENT_DEFAULT_CHANGED',
    },
  });

  persistedTest({
    name: 'FieldArgumentDefaultChangedModel (removed)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int = 1): String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }
    `,
    equalsObject: {
      meta: {
        argumentName: 'a',
        fieldName: 'ping',
        oldDefaultValue: '1',
        typeName: 'Query',
      },
      type: 'FIELD_ARGUMENT_DEFAULT_CHANGED',
    },
  });

  persistedTest({
    name: 'FieldArgumentDefaultChangedModel (added)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int = 1): String
      }
    `,
    equalsObject: {
      meta: {
        argumentName: 'a',
        fieldName: 'ping',
        newDefaultValue: '1',
        typeName: 'Query',
      },
      type: 'FIELD_ARGUMENT_DEFAULT_CHANGED',
    },
  });

  persistedTest({
    name: 'FieldArgumentTypeChangedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: String): String
      }
    `,
    equalsObject: {
      meta: {
        argumentName: 'a',
        fieldName: 'ping',
        isSafeArgumentTypeChange: false,
        newArgumentType: 'String',
        oldArgumentType: 'Int',
        typeName: 'Query',
      },
      type: 'FIELD_ARGUMENT_TYPE_CHANGED',
    },
  });

  persistedTest({
    name: 'DirectiveRemovedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo on FIELD
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }
    `,
    equalsObject: {
      meta: {
        removedDirectiveName: 'foo',
      },
      type: 'DIRECTIVE_REMOVED',
    },
  });

  persistedTest({
    name: 'DirectiveAddedLiteral',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo on FIELD
    `,
    equalsObject: {
      meta: {
        addedDirectiveName: 'foo',
      },
      type: 'DIRECTIVE_ADDED',
    },
  });

  persistedTest({
    name: 'DirectiveDescriptionChangedModel (removed)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      """
      yoyoyo
      """
      directive @foo on FIELD
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo on FIELD
    `,
    equalsObject: {
      meta: {
        directiveName: 'foo',
        oldDirectiveDescription: 'yoyoyo',
        newDirectiveDescription: null,
      },
      type: 'DIRECTIVE_DESCRIPTION_CHANGED',
    },
  });

  persistedTest({
    name: 'DirectiveDescriptionChangedModel (added)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo on FIELD
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      """
      yoyoyo
      """
      directive @foo on FIELD
    `,
    equalsObject: {
      meta: {
        directiveName: 'foo',
        oldDirectiveDescription: null,
        newDirectiveDescription: 'yoyoyo',
      },
      type: 'DIRECTIVE_DESCRIPTION_CHANGED',
    },
  });

  persistedTest({
    name: 'DirectiveDescriptionChangedModel (changed)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }
      """
      yo
      """
      directive @foo on FIELD
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      """
      yoyo
      """
      directive @foo on FIELD
    `,
    equalsObject: {
      meta: {
        directiveName: 'foo',
        oldDirectiveDescription: 'yo',
        newDirectiveDescription: 'yoyo',
      },
      type: 'DIRECTIVE_DESCRIPTION_CHANGED',
    },
  });

  persistedTest({
    name: 'DirectiveLocationAddedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo on FIELD
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo on FIELD | FRAGMENT_SPREAD
    `,
    equalsObject: {
      meta: {
        directiveName: 'foo',
        addedDirectiveLocation: 'FRAGMENT_SPREAD',
      },
      type: 'DIRECTIVE_LOCATION_ADDED',
    },
  });

  persistedTest({
    name: 'DirectiveLocationRemovedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }
      directive @foo on FIELD | FRAGMENT_SPREAD
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo on FIELD
    `,
    equalsObject: {
      meta: {
        directiveName: 'foo',
        removedDirectiveLocation: 'FRAGMENT_SPREAD',
      },
      type: 'DIRECTIVE_LOCATION_REMOVED',
    },
  });

  persistedTest({
    name: 'DirectiveArgumentRemovedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }
      directive @foo(a: Int) on FIELD
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo on FIELD
    `,
    equalsObject: {
      meta: {
        directiveName: 'foo',
        removedDirectiveArgumentName: 'a',
      },
      type: 'DIRECTIVE_ARGUMENT_REMOVED',
    },
  });

  persistedTest({
    name: 'DirectiveArgumentDescriptionChangedModel (changed)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo(
        """
        yo
        """
        a: Int
      ) on FIELD
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo(
        """
        yoyo
        """
        a: Int
      ) on FIELD
    `,
    equalsObject: {
      meta: {
        directiveName: 'foo',
        directiveArgumentName: 'a',
        oldDirectiveArgumentDescription: 'yo',
        newDirectiveArgumentDescription: 'yoyo',
      },
      type: 'DIRECTIVE_ARGUMENT_DESCRIPTION_CHANGED',
    },
  });

  persistedTest({
    name: 'DirectiveArgumentDescriptionChangedModel (removed)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo(
        """
        yo
        """
        a: Int
      ) on FIELD
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo(a: Int) on FIELD
    `,
    equalsObject: {
      meta: {
        directiveName: 'foo',
        directiveArgumentName: 'a',
        oldDirectiveArgumentDescription: 'yo',
        newDirectiveArgumentDescription: null,
      },
      type: 'DIRECTIVE_ARGUMENT_DESCRIPTION_CHANGED',
    },
  });

  persistedTest({
    name: 'DirectiveArgumentDescriptionChangedModel (added)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo(a: Int) on FIELD
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo(
        """
        yo
        """
        a: Int
      ) on FIELD
    `,
    equalsObject: {
      meta: {
        directiveName: 'foo',
        directiveArgumentName: 'a',
        oldDirectiveArgumentDescription: null,
        newDirectiveArgumentDescription: 'yo',
      },
      type: 'DIRECTIVE_ARGUMENT_DESCRIPTION_CHANGED',
    },
  });

  persistedTest({
    name: 'DirectiveArgumentDefaultValueChangedModel (changed)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo(a: Int = 1) on FIELD
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo(a: Int = 2) on FIELD
    `,
    equalsObject: {
      meta: {
        directiveName: 'foo',
        directiveArgumentName: 'a',
        oldDirectiveArgumentDefaultValue: '1',
        newDirectiveArgumentDefaultValue: '2',
      },
      type: 'DIRECTIVE_ARGUMENT_DEFAULT_VALUE_CHANGED',
    },
  });

  persistedTest({
    name: 'DirectiveArgumentDefaultValueChangedModel (added)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo(a: Int) on FIELD
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo(a: Int = 2) on FIELD
    `,
    equalsObject: {
      meta: {
        directiveName: 'foo',
        directiveArgumentName: 'a',
        newDirectiveArgumentDefaultValue: '2',
      },
      type: 'DIRECTIVE_ARGUMENT_DEFAULT_VALUE_CHANGED',
    },
  });

  persistedTest({
    name: 'DirectiveArgumentDefaultValueChangedModel (removed)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo(a: Int = 2) on FIELD
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo(a: Int) on FIELD
    `,
    equalsObject: {
      meta: {
        directiveName: 'foo',
        directiveArgumentName: 'a',
        oldDirectiveArgumentDefaultValue: '2',
      },
      type: 'DIRECTIVE_ARGUMENT_DEFAULT_VALUE_CHANGED',
    },
  });

  persistedTest({
    name: 'DirectiveArgumentTypeChangedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo(a: Int) on FIELD
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      directive @foo(a: String) on FIELD
    `,
    equalsObject: {
      meta: {
        directiveName: 'foo',
        directiveArgumentName: 'a',
        oldDirectiveArgumentType: 'Int',
        newDirectiveArgumentType: 'String',
        isSafeDirectiveArgumentTypeChange: false,
      },
      type: 'DIRECTIVE_ARGUMENT_TYPE_CHANGED',
    },
  });

  persistedTest({
    name: 'DirectiveArgumentTypeChangedModel (non deprecated)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        a
        b
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        a
      }
    `,
    equalsObject: {
      meta: {
        enumName: 'Foo',
        removedEnumValueName: 'b',
        isEnumValueDeprecated: false,
      },
      type: 'ENUM_VALUE_REMOVED',
    },
  });

  persistedTest({
    name: 'DirectiveArgumentTypeChangedModel (deprecated)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        a
        b @deprecated(reason: "reason")
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        a
      }
    `,
    equalsObject: {
      meta: {
        enumName: 'Foo',
        removedEnumValueName: 'b',
        isEnumValueDeprecated: true,
      },
      type: 'ENUM_VALUE_REMOVED',
    },
  });

  persistedTest({
    name: 'EnumValueAdded',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        a
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        a
        b
      }
    `,
    equalsObject: {
      meta: {
        enumName: 'Foo',
        addedEnumValueName: 'b',
      },
      type: 'ENUM_VALUE_ADDED',
    },
  });

  persistedTest({
    name: 'EnumValueDescriptionChangedModel (changed)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        """
        yo
        """
        a
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        """
        yoyo
        """
        a
      }
    `,
    equalsObject: {
      meta: {
        enumName: 'Foo',
        enumValueName: 'a',
        oldEnumValueDescription: 'yo',
        newEnumValueDescription: 'yoyo',
      },
      type: 'ENUM_VALUE_DESCRIPTION_CHANGED',
    },
  });

  persistedTest({
    name: 'EnumValueDescriptionChangedModel (added)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        a
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        """
        yo
        """
        a
      }
    `,
    equalsObject: {
      meta: {
        enumName: 'Foo',
        enumValueName: 'a',
        oldEnumValueDescription: null,
        newEnumValueDescription: 'yo',
      },
      type: 'ENUM_VALUE_DESCRIPTION_CHANGED',
    },
  });

  persistedTest({
    name: 'EnumValueDescriptionChangedModel (removed)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        """
        yo
        """
        a
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        a
      }
    `,
    equalsObject: {
      meta: {
        enumName: 'Foo',
        enumValueName: 'a',
        oldEnumValueDescription: 'yo',
        newEnumValueDescription: null,
      },
      type: 'ENUM_VALUE_DESCRIPTION_CHANGED',
    },
  });

  persistedTest({
    name: 'EnumValueDeprecationReasonChangedModel (deprecated)',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        a @deprecated(reason: "a")
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        a @deprecated(reason: "b")
      }
    `,
    equalsObject: {
      meta: {
        enumName: 'Foo',
        enumValueName: 'a',
        oldEnumValueDeprecationReason: 'a',
        newEnumValueDeprecationReason: 'b',
      },
      type: 'ENUM_VALUE_DEPRECATION_REASON_CHANGED',
    },
  });

  persistedTest({
    name: 'EnumValueDeprecationReasonAddedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        a
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        a @deprecated(reason: "b")
      }
    `,
    equalsObject: {
      meta: {
        enumName: 'Foo',
        enumValueName: 'a',
        addedValueDeprecationReason: 'b',
      },
      type: 'ENUM_VALUE_DEPRECATION_REASON_ADDED',
    },
  });

  persistedTest({
    name: 'EnumValueDeprecationReasonAddedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        a @deprecated(reason: "b")
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        ping(a: Int): String
      }

      enum Foo {
        a
      }
    `,
    equalsObject: {
      meta: {
        enumName: 'Foo',
        enumValueName: 'a',
        removedEnumValueDeprecationReason: 'b',
      },
      type: 'ENUM_VALUE_DEPRECATION_REASON_REMOVED',
    },
  });

  persistedTest({
    name: 'FieldRemovedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
        b: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        isRemovedFieldDeprecated: false,
        removedFieldName: 'b',
        typeType: 'object type',
      },
      type: 'FIELD_REMOVED',
    },
  });

  persistedTest({
    name: 'FieldAddedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String
        b: String
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        addedFieldName: 'b',
        typeType: 'object type',
      },
      type: 'FIELD_ADDED',
    },
  });

  persistedTest({
    name: 'FieldDescriptionChangedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        """
        yo
        """
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        """
        yoyo
        """
        a: String
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        fieldName: 'a',
        oldDescription: 'yo',
        newDescription: 'yoyo',
      },
      type: 'FIELD_DESCRIPTION_CHANGED',
    },
  });

  persistedTest({
    name: 'FieldDescriptionAddedModel (added)',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        """
        yoyo
        """
        a: String
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        fieldName: 'a',
        addedDescription: 'yoyo',
      },
      type: 'FIELD_DESCRIPTION_ADDED',
    },
  });

  persistedTest({
    name: 'FieldDescriptionRemovedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        """
        yo
        """
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        fieldName: 'a',
      },
      type: 'FIELD_DESCRIPTION_REMOVED',
    },
  });

  persistedTest({
    name: 'FieldDeprecationAddedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        """
        yo
        """
        a: String
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        fieldName: 'a',
        addedDescription: 'yo',
      },
      type: 'FIELD_DESCRIPTION_ADDED',
    },
  });

  persistedTest({
    name: 'FieldDeprecationRemovedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String @deprecated(reason: "yo")
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        fieldName: 'a',
      },
      type: 'FIELD_DEPRECATION_REMOVED',
    },
  });

  persistedTest({
    name: 'FieldDeprecationReasonChangedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String @deprecated(reason: "yo")
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String @deprecated(reason: "yoyo")
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        fieldName: 'a',
        oldDeprecationReason: 'yo',
        newDeprecationReason: 'yoyo',
      },
      type: 'FIELD_DEPRECATION_REASON_CHANGED',
    },
  });

  // persistedTest({
  //   name: 'FieldDeprecationReasonAddedModel',
  //   schemaBefore: /* GraphQL */ `
  //     type Query {
  //       a: String @deprecated
  //     }
  //   `,
  //   schemaAfter: /* GraphQL */ `
  //     type Query {
  //       a: String @deprecated(reason: "yoyo")
  //     }
  //   `,
  //   equalsObject: {
  //     meta: {
  //       typeName: 'Query',
  //       fieldName: 'a',
  //       addedDeprecationReason: 'yoyo',
  //     },
  //     type: 'FIELD_DEPRECATION_REASON_ADDED',
  //   },
  // });

  // persistedTest({
  //   name: 'FieldDeprecationReasonRemovedModel',
  //   schemaBefore: /* GraphQL */ `
  //     type Query {
  //       a: String @deprecated(reason: "yoyo")
  //     }
  //   `,
  //   schemaAfter: /* GraphQL */ `
  //     type Query {
  //       a: String @deprecated
  //     }
  //   `,
  //   equalsObject: {
  //     meta: {
  //       typeName: 'Query',
  //       fieldName: 'a',
  //     },
  //     type: 'FIELD_DEPRECATION_REASON_REMOVED',
  //   },
  // });

  persistedTest({
    name: 'FieldTypeChangedModel (unsafe)',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: Int
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        fieldName: 'a',
        oldFieldType: 'String',
        newFieldType: 'Int',
        isSafeFieldTypeChange: false,
      },
      type: 'FIELD_TYPE_CHANGED',
    },
  });

  persistedTest({
    name: 'FieldTypeChangedModel (safe)',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        fieldName: 'a',
        oldFieldType: 'String',
        newFieldType: 'String!',
        isSafeFieldTypeChange: true,
      },
      type: 'FIELD_TYPE_CHANGED',
    },
  });

  persistedTest({
    name: 'FieldArgumentAddedModel (unsafe)',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a(a: String!): String!
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        fieldName: 'a',
        addedArgumentName: 'a',
        addedArgumentType: 'String!',
        hasDefaultValue: false,
        isAddedFieldArgumentBreaking: true,
      },
      type: 'FIELD_ARGUMENT_ADDED',
    },
  });

  persistedTest({
    name: 'FieldArgumentAddedModel (safe)',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a(a: String): String!
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        fieldName: 'a',
        addedArgumentName: 'a',
        addedArgumentType: 'String',
        hasDefaultValue: false,
        isAddedFieldArgumentBreaking: false,
      },
      type: 'FIELD_ARGUMENT_ADDED',
    },
  });

  persistedTest({
    name: 'FieldArgumentRemovedModel (safe)',
    schemaBefore: /* GraphQL */ `
      type Query {
        a(a: String): String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'Query',
        fieldName: 'a',
        removedFieldArgumentName: 'a',
        removedFieldType: 'String',
      },
      type: 'FIELD_ARGUMENT_REMOVED',
    },
  });

  persistedTest({
    name: 'InputFieldAddedModel (safe)',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }

      input A {
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      input A {
        a: String
        b: String
      }
    `,
    equalsObject: {
      meta: {
        inputName: 'A',
        addedInputFieldName: 'b',
        isAddedInputFieldTypeNullable: true,
        addedInputFieldType: 'String',
      },
      type: 'INPUT_FIELD_ADDED',
    },
  });

  persistedTest({
    name: 'InputFieldAddedModel (unsafe)',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }

      input A {
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      input A {
        a: String
        b: String!
      }
    `,
    equalsObject: {
      meta: {
        inputName: 'A',
        addedInputFieldName: 'b',
        isAddedInputFieldTypeNullable: false,
        addedInputFieldType: 'String!',
      },
      type: 'INPUT_FIELD_ADDED',
    },
  });

  persistedTest({
    name: 'InputFieldDescriptionAddedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }

      input A {
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      input A {
        """
        yo
        """
        a: String
      }
    `,
    equalsObject: {
      meta: {
        inputName: 'A',
        inputFieldName: 'a',
        addedInputFieldDescription: 'yo',
      },
      type: 'INPUT_FIELD_DESCRIPTION_ADDED',
    },
  });

  persistedTest({
    name: 'InputFieldDescriptionRemovedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }

      input A {
        """
        yo
        """
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      input A {
        a: String
      }
    `,
    equalsObject: {
      meta: {
        inputName: 'A',
        inputFieldName: 'a',
        removedDescription: 'yo',
      },
      type: 'INPUT_FIELD_DESCRIPTION_REMOVED',
    },
  });

  persistedTest({
    name: 'InputFieldDescriptionChangedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }

      input A {
        """
        yo
        """
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      input A {
        """
        yoyo
        """
        a: String
      }
    `,
    equalsObject: {
      meta: {
        inputName: 'A',
        inputFieldName: 'a',
        oldInputFieldDescription: 'yo',
        newInputFieldDescription: 'yoyo',
      },
      type: 'INPUT_FIELD_DESCRIPTION_CHANGED',
    },
  });

  persistedTest({
    name: 'InputFieldDefaultValueChangedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }

      input A {
        a: String = "yo"
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      input A {
        a: String = null
      }
    `,
    equalsObject: {
      meta: {
        inputName: 'A',
        inputFieldName: 'a',
        oldDefaultValue: `"yo"`,
        newDefaultValue: 'null',
      },
      type: 'INPUT_FIELD_DEFAULT_VALUE_CHANGED',
    },
  });

  persistedTest({
    name: 'InputFieldTypeChangedModel (safe)',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }

      input A {
        a: String!
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      input A {
        a: String
      }
    `,
    equalsObject: {
      meta: {
        inputName: 'A',
        inputFieldName: 'a',
        oldInputFieldType: 'String!',
        newInputFieldType: 'String',
        isInputFieldTypeChangeSafe: true,
      },
      type: 'INPUT_FIELD_TYPE_CHANGED',
    },
  });

  persistedTest({
    name: 'InputFieldTypeChangedModel (unsafe)',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }

      input A {
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      input A {
        a: String!
      }
    `,
    equalsObject: {
      meta: {
        inputName: 'A',
        inputFieldName: 'a',
        oldInputFieldType: 'String',
        newInputFieldType: 'String!',
        isInputFieldTypeChangeSafe: false,
      },
      type: 'INPUT_FIELD_TYPE_CHANGED',
    },
  });

  persistedTest({
    name: 'ObjectTypeInterfaceAddedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String
      }

      interface Foo {
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query implements Foo {
        a: String!
      }

      interface Foo {
        a: String
      }
    `,
    equalsObject: {
      meta: {
        objectTypeName: 'Query',
        addedInterfaceName: 'Foo',
      },
      type: 'OBJECT_TYPE_INTERFACE_ADDED',
    },
  });

  persistedTest({
    name: 'ObjectTypeInterfaceAddedModel',
    schemaBefore: /* GraphQL */ `
      type Query implements Foo {
        a: String!
      }

      interface Foo {
        a: String
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String
      }

      interface Foo {
        a: String
      }
    `,
    equalsObject: {
      meta: {
        objectTypeName: 'Query',
        removedInterfaceName: 'Foo',
      },
      type: 'OBJECT_TYPE_INTERFACE_REMOVED',
    },
  });

  // persistedTest({
  //   name: 'SchemaQueryTypeChangedModel',
  //   schemaBefore: /* GraphQL */ `
  //     type Query {
  //       a: Query
  //       b: Query2
  //     }

  //     type Query2 {
  //       a: Query
  //       b: Query2
  //     }

  //     schema {
  //       query: Query
  //     }
  //   `,
  //   schemaAfter: /* GraphQL */ `
  //     type Query {
  //       a: Query
  //       b: Query2
  //     }

  //     type Query2 {
  //       a: Query
  //       b: Query2
  //     }

  //     schema {
  //       query: Query2
  //     }
  //   `,
  //   equalsObject: {
  //     meta: {
  //       oldQueryTypeName: 'Query',
  //       newQueryTypeName: 'Query2',
  //     },
  //     type: 'SCHEMA_QUERY_TYPE_CHANGED',
  //   },
  // });

  // persistedTest({
  //   name: 'SchemaMutationTypeChangedModel',
  //   schemaBefore: /* GraphQL */ `
  //     type Query {
  //       a: String!
  //     }

  //     type Mutation {
  //       b: String!
  //     }

  //     type Mutation1 {
  //       c: String!
  //     }

  //     schema {
  //       query: Query
  //       mutation: Mutation
  //     }
  //   `,
  //   schemaAfter: /* GraphQL */ `
  //     type Query {
  //       a: String!
  //     }

  //     type Mutation {
  //       b: String!
  //     }

  //     type Mutation1 {
  //       c: String!
  //     }

  //     schema {
  //       query: Query
  //       mutation: Mutation1
  //     }
  //   `,
  //   equalsObject: {
  //     meta: {
  //       oldMutationTypeName: 'Mutation',
  //       newMutationTypeName: 'Mutation1',
  //     },
  //     type: 'SCHEMA_MUTATION_TYPE_CHANGED',
  //   },
  // });

  // persistedTest({
  //   name: 'SchemaSubscriptionTypeChangedModel',
  //   schemaBefore: /* GraphQL */ `
  //     type Query {
  //       a: String!
  //     }

  //     type Subscription {
  //       b: String!
  //     }

  //     type Subscription1 {
  //       c: String!
  //     }

  //     schema {
  //       query: Query
  //       subscription: Subscription
  //     }
  //   `,
  //   schemaAfter: /* GraphQL */ `
  //     type Query {
  //       a: String!
  //     }

  //     type Subscription {
  //       b: String!
  //     }

  //     type Subscription1 {
  //       c: String!
  //     }

  //     schema {
  //       query: Query
  //       subscription: Subscription1
  //     }
  //   `,
  //   equalsObject: {
  //     meta: {
  //       oldSubscriptionTypeName: 'Subscription',
  //       newSubscriptionTypeName: 'Subscription1',
  //     },
  //     type: 'SCHEMA_SUBSCRIPTION_TYPE_CHANGED',
  //   },
  // });

  persistedTest({
    name: 'TypeRemovedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String!
      }

      type A {
        b: String!
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }
    `,
    equalsObject: {
      meta: {
        removedTypeName: 'A',
      },
      type: 'TYPE_REMOVED',
    },
  });

  persistedTest({
    name: 'TypeAddedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String!
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      type A {
        b: String!
      }
    `,
    equalsObject: {
      meta: {
        addedTypeName: 'A',
      },
      type: 'TYPE_ADDED',
    },
  });

  persistedTest({
    name: 'TypeKindChangedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String!
      }

      type A {
        b: String!
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      interface A {
        b: String!
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'A',
        oldTypeKind: 'ObjectTypeDefinition',
        newTypeKind: 'InterfaceTypeDefinition',
      },
      type: 'TYPE_KIND_CHANGED',
    },
  });

  persistedTest({
    name: 'TypeDescriptionChangedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String!
      }

      """
      yo
      """
      type A {
        b: String!
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      """
      yoyo
      """
      type A {
        b: String!
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'A',
        oldTypeDescription: 'yo',
        newTypeDescription: 'yoyo',
      },
      type: 'TYPE_DESCRIPTION_CHANGED',
    },
  });

  persistedTest({
    name: 'TypeDescriptionAddedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String!
      }

      type A {
        b: String!
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      """
      yoyo
      """
      type A {
        b: String!
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'A',
        addedTypeDescription: 'yoyo',
      },
      type: 'TYPE_DESCRIPTION_ADDED',
    },
  });

  persistedTest({
    name: 'TypeDescriptionRemovedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String!
      }

      """
      yoyo
      """
      type A {
        b: String!
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      type A {
        b: String!
      }
    `,
    equalsObject: {
      meta: {
        typeName: 'A',
        removedTypeDescription: 'yoyo',
      },
      type: 'TYPE_DESCRIPTION_REMOVED',
    },
  });

  persistedTest({
    name: 'UnionMemberAddedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String!
      }

      type A {
        b: String!
      }

      type B {
        d: String!
      }

      union C = A
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      type A {
        b: String!
      }

      type B {
        d: String!
      }

      union C = A | B
    `,
    equalsObject: {
      meta: {
        unionName: 'C',
        addedUnionMemberTypeName: 'B',
      },
      type: 'UNION_MEMBER_ADDED',
    },
  });

  persistedTest({
    name: 'UnionMemberAddedModel',
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String!
      }

      type A {
        b: String!
      }

      type B {
        d: String!
      }

      union C = A | B
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }

      type A {
        b: String!
      }

      type B {
        d: String!
      }

      union C = A
    `,
    equalsObject: {
      meta: {
        unionName: 'C',
        removedUnionMemberTypeName: 'B',
      },
      type: 'UNION_MEMBER_REMOVED',
    },
  });
});

const SchemaCompareToPreviousVersionQuery = graphql(`
  query SchemaCompareToPreviousVersionQuery(
    $organization: ID!
    $project: ID!
    $target: ID!
    $version: ID!
  ) {
    schemaCompareToPrevious(
      selector: {
        organization: $organization
        project: $project
        target: $target
        version: $version
      }
    ) {
      ... on SchemaCompareResult {
        initial
        changes {
          total
          nodes {
            path
            message
            criticality
          }
        }
        diff {
          before
          after
        }
      }
      ... on SchemaCompareError {
        message
        details {
          message
          type
        }
      }
    }
  }
`);

test('Query.schemaCompareToPrevious: result is read from the database', async () => {
  const storage = await createStorage(connectionString(), 1);

  try {
    const serviceName = {
      service: 'test',
    };

    const serviceUrl = { url: 'http://localhost:4000' };

    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createToken, target, project } = await createProject(ProjectType.Federation, {});
    const readWriteToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
    });

    const publishResult = await readWriteToken
      .publishSchema({
        author: 'gilad',
        commit: '123',
        sdl: `type Query { ping: String }`,
        ...serviceName,
        ...serviceUrl,
      })
      .then(r => r.expectNoGraphQLErrors());
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const publishResult2 = await readWriteToken
      .publishSchema({
        force: true,
        author: 'gilad',
        commit: '456',
        sdl: `type Query { ping: Int }`,
        ...serviceName,
        ...serviceUrl,
      })
      .then(r => r.expectNoGraphQLErrors());

    if (publishResult2.schemaPublish.__typename !== 'SchemaPublishSuccess') {
      expect(publishResult2.schemaPublish.__typename).toBe('SchemaPublishSuccess');
      return;
    }

    const latestVersion = await storage.getLatestVersion({
      target: target.id,
      project: project.id,
    });

    const result = await execute({
      document: SchemaCompareToPreviousVersionQuery,
      variables: {
        organization: organization.cleanId,
        project: project.cleanId,
        target: target.cleanId,
        version: latestVersion.id,
      },
      authToken: ownerToken,
    }).then(res => res.expectNoGraphQLErrors());

    expect((result.schemaCompareToPrevious as Record<string, unknown>).changes)
      .toMatchInlineSnapshot(`
      {
        nodes: [
          {
            criticality: Breaking,
            message: Field 'Query.ping' changed type from 'String' to 'Int',
            path: [
              Query,
              ping,
            ],
          },
        ],
        total: 1,
      }
    `);
  } finally {
    await storage.destroy();
  }
});

// TODO: conditional breaking changes test

test('Composition Error (Federation 2) can be served from the database', async () => {
  const storage = await createStorage(connectionString(), 1);
  const dockerAddress = `composition_federation_2:3069`;

  try {
    const initialSchema = /* GraphQL */ `
      type Product @key(fields: "id") {
        id: ID!
        title: String
        url: String
        description: String
        salesRankOverall: Int
        salesRankInCategory: Int
        images(size: Int = 1000): [String]
        primaryImage(size: Int = 1000): String
      }

      type Query {
        product(id: ID!): Product
      }
    `;

    const newSchema = /* GraphQL */ `
      type Product @key(fields: "IDONOTEXIST") {
        id: ID!
        title: String
        url: String
        description: String
        salesRankOverall: Int
        salesRankInCategory: Int
        images(size: Int = 1000): [String]
        primaryImage(size: Int = 1000): String
      }

      type Query {
        product(id: ID!): Product
      }
    `;

    const serviceName = {
      service: 'test',
    };

    const serviceUrl = { url: 'http://localhost:4000' };

    const { createOrg, ownerToken } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createToken, target, project } = await createProject(ProjectType.Federation, {});
    const readWriteToken = await createToken({
      targetScopes: [
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
      projectScopes: [ProjectAccessScope.Settings],
      organizationScopes: [],
    });

    await enableExternalSchemaComposition(
      {
        endpoint: `http://${dockerAddress}/compose`,
        // eslint-disable-next-line no-process-env
        secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
        project: project.cleanId,
        organization: organization.cleanId,
      },
      readWriteToken.secret,
    ).then(r => r.expectNoGraphQLErrors());

    const publishResult = await readWriteToken
      .publishSchema({
        author: 'gilad',
        commit: '123',
        sdl: initialSchema,
        ...serviceName,
        ...serviceUrl,
      })
      .then(r => r.expectNoGraphQLErrors());
    console.log(JSON.stringify(publishResult.schemaPublish, null, 2));
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const publishResult2 = await readWriteToken
      .publishSchema({
        author: 'gilad',
        commit: '456',
        sdl: newSchema,
        ...serviceName,
        ...serviceUrl,
      })
      .then(r => r.expectNoGraphQLErrors());

    if (publishResult2.schemaPublish.__typename !== 'SchemaPublishSuccess') {
      expect(publishResult2.schemaPublish.__typename).toBe('SchemaPublishSuccess');
      return;
    }

    const latestVersion = await storage.getLatestVersion({
      target: target.id,
      project: project.id,
      organization: organization.id,
    });

    const result = await execute({
      document: SchemaCompareToPreviousVersionQuery,
      variables: {
        organization: organization.cleanId,
        project: project.cleanId,
        target: target.cleanId,
        version: latestVersion.id,
      },
      authToken: ownerToken,
    }).then(res => res.expectNoGraphQLErrors());

    expect(result).toMatchInlineSnapshot(`
      {
        schemaCompareToPrevious: {
          details: [
            {
              message: [test] On type "Product", for @key(fields: "IDONOTEXIST"): Cannot query field "IDONOTEXIST" on type "Product" (the field should either be added to this subgraph or, if it should not be resolved by this subgraph, you need to add it to this subgraph with @external).,
              type: composition,
            },
          ],
          message: Composition error,
        },
      }
    `);
  } finally {
    await storage.destroy();
  }
});
