import 'reflect-metadata';
import { createPool, sql } from 'slonik';
import { graphql } from 'testkit/gql';
/* eslint-disable no-process-env */
import { ProjectAccessScope, ProjectType, TargetAccessScope } from 'testkit/gql/graphql';
import { execute } from 'testkit/graphql';
import { getServiceHost } from 'testkit/utils';
// eslint-disable-next-line import/no-extraneous-dependencies
import { createStorage } from '@hive/storage';
import {
  createTarget,
  enableExternalSchemaComposition,
  publishSchema,
} from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';

test.concurrent(
  'cannot publish a schema without target:registry:write access',
  async ({ expect }) => {
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
  },
);

test.concurrent('can publish a schema with target:registry:write access', async ({ expect }) => {
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

test.concurrent(
  'base schema should not affect the output schema persisted in db',
  async ({ expect }) => {
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
  },
);

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

test.concurrent('share publication of schema using redis', async ({ expect }) => {
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

test.concurrent('CDN data can not be fetched with an invalid access token', async ({ expect }) => {
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

test.concurrent('CDN data can be fetched with an valid access token', async ({ expect }) => {
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

test.concurrent('cannot do API request with invalid access token', async ({ expect }) => {
  const errors = await publishSchema(
    {
      commit: '1',
      sdl: 'type Query { smokeBangBang: String }',
      author: 'Kamil',
    },
    'foobars',
  ).then(r => r.expectGraphQLErrors());

  expect(errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        message: 'Invalid token provided',
      }),
    ]),
  );
});

test.concurrent(
  'should publish only one schema if multiple same publishes are started in parallel',
  async ({ expect }) => {
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

  test.concurrent(
    'linkToWebsite should be available when publishing initial schema',
    async ({ expect }) => {
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
        `${process.env.HIVE_APP_BASE_URL}/${organization.slug}/${project.slug}/${target.slug}`,
      );
    },
  );

  test.concurrent(
    'linkToWebsite should be available when publishing non-initial schema',
    async ({ expect }) => {
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
        `${process.env.HIVE_APP_BASE_URL}/${organization.slug}/${project.slug}/${target.slug}/history/`,
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
        organization: organization.slug,
        project: project.slug,
        slug: 'target2',
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());
    const target2 = createTargetResult.createTarget.ok!.createdTarget;
    const writeTokenResult2 = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
      target: target2,
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

function connectionString() {
  const {
    POSTGRES_USER = 'postgres',
    POSTGRES_PASSWORD = 'postgres',
    POSTGRES_HOST = 'localhost',
    POSTGRES_PORT = 5432,
    POSTGRES_DB = 'registry',
    POSTGRES_SSL = null,
    POSTGRES_CONNECTION_STRING = null,
  } = process.env;
  return (
    POSTGRES_CONNECTION_STRING ||
    `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}${
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
    type?: ProjectType;
    schemaBefore: string;
    schemaAfter: string;
    equalsObject: {
      meta: unknown;
      type: unknown;
    };
    /** Only provide if you want to test a service url change */
    serviceUrlAfter?: string;
  }) {
    test.concurrent(`[Schema change] ${args.name}`, async ({ expect }) => {
      const serviceName = {
        service: 'test',
      };

      const serviceUrl = { url: 'http://localhost:4000' };

      const { createOrg } = await initSeed().createOwner();
      const { createProject, organization } = await createOrg();
      const { createToken, target, project } = await createProject(
        args.type ?? ProjectType.Single,
        {},
      );
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
          url: args.serviceUrlAfter ?? serviceUrl.url,
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

      if (!Array.isArray(changes)) {
        throw new Error('Expected changes to be an array');
      }

      expect(changes[0]['meta']).toEqual(args.equalsObject['meta']);
      expect(changes[0]['type']).toEqual(args.equalsObject['type']);
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

  persistedTest({
    name: 'RegistryServiceUrlChangeModel',
    type: ProjectType.Federation,
    schemaBefore: /* GraphQL */ `
      type Query {
        a: String!
      }
    `,
    schemaAfter: /* GraphQL */ `
      type Query {
        a: String!
      }
    `,
    serviceUrlAfter: 'http://iliketurtles.com/graphql',
    equalsObject: {
      meta: {
        serviceName: 'test',
        serviceUrls: {
          old: 'http://localhost:4000',
          new: 'http://iliketurtles.com/graphql',
        },
      },
      type: 'REGISTRY_SERVICE_URL_CHANGED',
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
    target(selector: { organization: $organization, project: $project, target: $target }) {
      id
      schemaVersion(id: $version) {
        id
        sdl
        supergraph
        log {
          ... on PushedSchemaLog {
            id
            author
            service
            commit
            serviceSdl
            previousServiceSdl
          }
          ... on DeletedSchemaLog {
            id
            deletedService
            previousServiceSdl
          }
        }
        schemaCompositionErrors {
          nodes {
            message
          }
        }
        isFirstComposableVersion
        breakingSchemaChanges {
          nodes {
            message(withSafeBasedOnUsageNote: false)
            criticality
            criticalityReason
            path
            approval {
              approvedBy {
                id
                displayName
              }
              approvedAt
              schemaCheckId
            }
            isSafeBasedOnUsage
          }
        }
        safeSchemaChanges {
          nodes {
            message(withSafeBasedOnUsageNote: false)
            criticality
            criticalityReason
            path
            approval {
              approvedBy {
                id
                displayName
              }
              approvedAt
              schemaCheckId
            }
            isSafeBasedOnUsage
          }
        }
        previousDiffableSchemaVersion {
          id
          supergraph
          sdl
        }
      }
    }
  }
`);

test('Target.schemaVersion: result is read from the database', async () => {
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
      organization: organization.id,
    });

    const result = await execute({
      document: SchemaCompareToPreviousVersionQuery,
      variables: {
        organization: organization.slug,
        project: project.slug,
        target: target.slug,
        version: latestVersion.id,
      },
      authToken: ownerToken,
    }).then(res => res.expectNoGraphQLErrors());

    expect(result?.target?.schemaVersion?.breakingSchemaChanges?.nodes).toMatchInlineSnapshot(`
      [
        {
          approval: null,
          criticality: Breaking,
          criticalityReason: null,
          isSafeBasedOnUsage: false,
          message: Field 'Query.ping' changed type from 'String' to 'Int',
          path: [
            Query,
            ping,
          ],
        },
      ]
    `);
    expect(result?.target?.schemaVersion?.safeSchemaChanges?.nodes).toBeUndefined();
  } finally {
    await storage.destroy();
  }
});

test('Composition Error (Federation 2) can be served from the database', async () => {
  const storage = await createStorage(connectionString(), 1);
  const serviceAddress = await getServiceHost('composition_federation_2', 3069, false);

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
    const { createToken, target, project, setNativeFederation } = await createProject(
      ProjectType.Federation,
      {},
    );
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
        endpoint: `http://${serviceAddress}/compose`,
        // eslint-disable-next-line no-process-env
        secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
        project: project.slug,
        organization: organization.slug,
      },
      readWriteToken.secret,
    ).then(r => r.expectNoGraphQLErrors());
    // set native federation to false to force external composition
    await setNativeFederation(false);

    const publishResult = await readWriteToken
      .publishSchema({
        author: 'gilad',
        commit: '123',
        sdl: initialSchema,
        ...serviceName,
        ...serviceUrl,
      })
      .then(r => r.expectNoGraphQLErrors());

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
        organization: organization.slug,
        project: project.slug,
        target: target.slug,
        version: latestVersion.id,
      },
      authToken: ownerToken,
    }).then(res => res.expectNoGraphQLErrors());

    expect(result?.target?.schemaVersion?.schemaCompositionErrors?.nodes).toMatchInlineSnapshot(`
      [
        {
          message: [test] On type "Product", for @key(fields: "IDONOTEXIST"): Cannot query field "IDONOTEXIST" on type "Product" (the field should either be added to this subgraph or, if it should not be resolved by this subgraph, you need to add it to this subgraph with @external).,
        },
      ]
    `);
  } finally {
    await storage.destroy();
  }
});

test('Composition Network Failure (Federation 2)', async () => {
  const storage = await createStorage(connectionString(), 1);
  const serviceAddress = await getServiceHost('composition_federation_2', 3069, false);

  try {
    const initialSchema = /* GraphQL */ `
      type Product @key(fields: "id") {
        id: ID!
      }

      type Query {
        product(id: ID!): Product
      }
    `;

    const newSchema = /* GraphQL */ `
      type Product @key(fields: "id") {
        id: ID!
        title: String
      }

      type Query {
        product(id: ID!): Product
      }
    `;

    const newNewSchema = /* GraphQL */ `
      type Product @key(fields: "id") {
        id: ID!
        title: String
        url: String
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
    const { createToken, target, project, setNativeFederation } = await createProject(
      ProjectType.Federation,
      {},
    );
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
        endpoint: `http://${serviceAddress}/compose`,
        // eslint-disable-next-line no-process-env
        secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
        project: project.slug,
        organization: organization.slug,
      },
      readWriteToken.secret,
    ).then(r => r.expectNoGraphQLErrors());

    // Disable Native Federation v2 composition to allow the external composition to take place
    await setNativeFederation(false);

    const publishResult = await readWriteToken
      .publishSchema({
        author: 'gilad',
        commit: '123',
        sdl: initialSchema,
        ...serviceName,
        ...serviceUrl,
      })
      .then(r => r.expectNoGraphQLErrors());

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

    await enableExternalSchemaComposition(
      {
        endpoint: `http://${serviceAddress}/no_compose`,
        secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
        project: project.slug,
        organization: organization.slug,
      },
      readWriteToken.secret,
    ).then(r => r.expectNoGraphQLErrors());
    // Disable Native Federation v2 composition to allow the external composition to take place
    await setNativeFederation(false);

    const publishResult3 = await readWriteToken
      .publishSchema({
        author: 'gilad',
        commit: '456',
        sdl: newNewSchema,
        ...serviceName,
        ...serviceUrl,
      })
      .then(r => r.expectNoGraphQLErrors());

    if (publishResult3.schemaPublish.__typename !== 'SchemaPublishError') {
      expect(publishResult3.schemaPublish.__typename).toBe('SchemaPublishError');
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
        organization: organization.slug,
        project: project.slug,
        target: target.slug,
        version: latestVersion.id,
      },
      authToken: ownerToken,
    }).then(res => res.expectNoGraphQLErrors());

    expect(result?.target?.schemaVersion?.safeSchemaChanges?.nodes).toMatchInlineSnapshot(`
      [
        {
          approval: null,
          criticality: Safe,
          criticalityReason: null,
          isSafeBasedOnUsage: false,
          message: Field 'title' was added to object type 'Product',
          path: [
            Product,
            title,
          ],
        },
      ]
    `);
    expect(result?.target?.schemaVersion?.breakingSchemaChanges?.nodes).toBeUndefined();

    expect(result?.target?.schemaVersion?.sdl).toMatchInlineSnapshot(`
      type Product {
        id: ID!
        title: String
      }

      type Query {
        product(id: ID!): Product
      }
    `);
    expect(result?.target?.schemaVersion?.previousDiffableSchemaVersion?.sdl)
      .toMatchInlineSnapshot(`
      type Product {
        id: ID!
      }

      type Query {
        product(id: ID!): Product
      }
    `);
  } finally {
    await storage.destroy();
  }
});

test.concurrent(
  'service url change is persisted and can be fetched via api',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Federation);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [ProjectAccessScope.Settings, ProjectAccessScope.Read],
      organizationScopes: [],
    });

    const sdl = /* GraphQL */ `
      type Query {
        products: [Product]
      }
      type Product @key(fields: "id") {
        id: ID!
      }
    `;

    let publishProductsResult = await writeToken
      .publishSchema({
        url: 'https://api.com/products',
        sdl,
        service: 'foo',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(publishProductsResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    publishProductsResult = await writeToken
      .publishSchema({
        url: 'https://api.com/products-new',
        sdl,
        service: 'foo',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(publishProductsResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const result = await writeToken.fetchLatestValidSchema();
    const versionId = result.latestValidVersion?.id;

    if (!versionId) {
      expect(versionId).toBeInstanceOf(String);
      return;
    }

    const compareResult = await writeToken.compareToPreviousVersion(versionId);
    expect(compareResult?.target?.schemaVersion?.safeSchemaChanges?.nodes).toMatchInlineSnapshot(`
      [
        {
          approval: null,
          criticality: Dangerous,
          criticalityReason: The registry service url has changed,
          isSafeBasedOnUsage: false,
          message: [foo] New service url: 'https://api.com/products-new' (previously: 'https://api.com/products'),
          path: null,
        },
      ]
    `);
    expect(compareResult?.target?.schemaVersion?.breakingSchemaChanges?.nodes).toBeUndefined();
  },
);

test.concurrent(
  'service url change is persisted and can be fetched via api (in combination with other change)',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Federation);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [ProjectAccessScope.Settings, ProjectAccessScope.Read],
      organizationScopes: [],
    });

    let publishProductsResult = await writeToken
      .publishSchema({
        url: 'https://api.com/products',
        sdl: /* GraphQL */ `
          type Query {
            products: [Product]
          }
          type Product @key(fields: "id") {
            id: ID!
          }
        `,
        service: 'foo',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(publishProductsResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    publishProductsResult = await writeToken
      .publishSchema({
        url: 'https://api.com/products-new',
        sdl: /* GraphQL */ `
          type Query {
            products: [Product]
          }
          type Product @key(fields: "id") {
            id: ID!
            name: String!
          }
        `,
        service: 'foo',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(publishProductsResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const result = await writeToken.fetchLatestValidSchema();
    const versionId = result.latestValidVersion?.id;

    if (!versionId) {
      expect(versionId).toBeInstanceOf(String);
      return;
    }

    const compareResult = await writeToken.compareToPreviousVersion(versionId);

    expect(compareResult?.target?.schemaVersion?.safeSchemaChanges?.nodes).toMatchInlineSnapshot(`
      [
        {
          approval: null,
          criticality: Safe,
          criticalityReason: null,
          isSafeBasedOnUsage: false,
          message: Field 'name' was added to object type 'Product',
          path: [
            Product,
            name,
          ],
        },
        {
          approval: null,
          criticality: Dangerous,
          criticalityReason: The registry service url has changed,
          isSafeBasedOnUsage: false,
          message: [foo] New service url: 'https://api.com/products-new' (previously: 'https://api.com/products'),
          path: null,
        },
      ]
    `);
    expect(compareResult?.target?.schemaVersion?.breakingSchemaChanges?.nodes).toBeUndefined();
  },
);

const insertLegacyVersion = async (
  pool: Awaited<ReturnType<typeof createPool>>,
  args: {
    sdl: string;
    projectId: string;
    targetId: string;
    serviceUrl: string;
  },
) => {
  const logId = await pool.oneFirst<string>(sql`
        INSERT INTO schema_log
          (
            author,
            service_name,
            service_url,
            commit,
            sdl,
            project_id,
            target_id,
            metadata,
            action
          )
        VALUES
          (
            ${'Laurin did it again'},
            lower(${'foo'}),
            ${args.serviceUrl}::text,
            ${'42069'}::text,
            ${args.sdl}::text,
            ${args.projectId},
            ${args.targetId},
            ${null},
            'PUSH'
          )
        RETURNING id
      `);

  const versionId = await pool.oneFirst<string>(sql`
        INSERT INTO schema_versions
          (
            is_composable,
            target_id,
            action_id
          )
        VALUES
          (
            ${true},
            ${args.targetId},
            ${logId}
          )
        RETURNING "id"
      `);

  await pool.query(sql`
        INSERT INTO
          schema_version_to_log
          (version_id, action_id)
        VALUES
          (${versionId}, ${logId})
      `);

  return versionId;
};

test.concurrent(
  'service url change from legacy to new version is displayed correctly',
  async ({ expect }) => {
    let pool: Awaited<ReturnType<typeof createPool>> | undefined;
    try {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { project, target, createToken } = await createProject(ProjectType.Federation);

      // Create a token with write rights
      const writeToken = await createToken({
        targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
        projectScopes: [ProjectAccessScope.Settings, ProjectAccessScope.Read],
        organizationScopes: [],
      });

      // We need to seed a legacy entry in the database

      const conn = connectionString();
      pool = await createPool(conn);

      const sdl = 'type Query { ping: String! }';

      await insertLegacyVersion(pool, {
        projectId: project.id,
        targetId: target.id,
        sdl,
        serviceUrl: 'https://api.com/products',
      });

      const publishProductsResult = await writeToken
        .publishSchema({
          url: 'https://api.com/nah',
          sdl,
          service: 'foo',
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(publishProductsResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

      const newVersionId = (await writeToken.fetchLatestValidSchema())?.latestValidVersion?.id;

      if (!newVersionId) {
        expect(newVersionId).toBeInstanceOf(String);
        return;
      }

      const compareResult = await writeToken.compareToPreviousVersion(newVersionId);
      expect(compareResult?.target?.schemaVersion?.safeSchemaChanges?.nodes).toMatchInlineSnapshot(`
        [
          {
            approval: null,
            criticality: Dangerous,
            criticalityReason: The registry service url has changed,
            isSafeBasedOnUsage: false,
            message: [foo] New service url: 'https://api.com/nah' (previously: 'https://api.com/products'),
            path: null,
          },
        ]
      `);
      expect(compareResult?.target?.schemaVersion?.breakingSchemaChanges?.nodes).toBeUndefined();
    } finally {
      await pool?.end();
    }
  },
);

test.concurrent(
  'legacy stitching project service without url results in correct change when an url is added',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { /* project, target,*/ createToken } = await createProject(ProjectType.Stitching, {
      useLegacyRegistryModels: true,
    });

    const writeToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [ProjectAccessScope.Settings, ProjectAccessScope.Read],
      organizationScopes: [],
    });

    let result = await writeToken
      .publishSchema({
        sdl: 'type Query { ping: String! }',
        author: 'Laurin',
        commit: '123',
        service: 'foo1',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(result.schemaPublish.__typename).toEqual('SchemaPublishSuccess');

    result = await writeToken
      .publishSchema({
        sdl: 'type Query { ping: String! }',
        author: 'Laurin',
        commit: '123',
        service: 'foo1',
        url: 'https://api.com/foo1',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(result.schemaPublish.__typename).toEqual('SchemaPublishSuccess');

    const newVersionId = (await writeToken.fetchLatestValidSchema())?.latestValidVersion?.id;

    if (typeof newVersionId !== 'string') {
      throw new Error('newVersionId is not a string');
    }

    const compareResult = await writeToken.compareToPreviousVersion(newVersionId);
    expect(compareResult?.target?.schemaVersion?.safeSchemaChanges?.nodes).toMatchInlineSnapshot(`
      [
        {
          approval: null,
          criticality: Dangerous,
          criticalityReason: The registry service url has changed,
          isSafeBasedOnUsage: false,
          message: [foo1] New service url: 'https://api.com/foo1' (previously: 'none'),
          path: null,
        },
      ]
    `);
    expect(compareResult?.target?.schemaVersion?.breakingSchemaChanges?.nodes).toBeUndefined();
  },
);

test.concurrent(
  'service url change from legacy to legacy version is displayed correctly',
  async ({ expect }) => {
    let pool: Awaited<ReturnType<typeof createPool>> | undefined;
    try {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { project, target, createToken } = await createProject(ProjectType.Federation);

      // Create a token with write rights
      const writeToken = await createToken({
        targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
        projectScopes: [ProjectAccessScope.Settings, ProjectAccessScope.Read],
        organizationScopes: [],
      });

      // We need to seed a legacy entry in the database

      const conn = connectionString();
      pool = await createPool(conn);

      const sdl = 'type Query { ping: String! }';

      await insertLegacyVersion(pool, {
        projectId: project.id,
        targetId: target.id,
        sdl,
        serviceUrl: 'https://api.com/products',
      });

      await insertLegacyVersion(pool, {
        projectId: project.id,
        targetId: target.id,
        sdl,
        serviceUrl: 'https://api.com/nah',
      });

      const newVersionId = (await writeToken.fetchLatestValidSchema())?.latestValidVersion?.id;

      if (!newVersionId) {
        expect(newVersionId).toBeInstanceOf(String);
        return;
      }

      const compareResult = await writeToken.compareToPreviousVersion(newVersionId);

      expect(compareResult?.target?.schemaVersion?.safeSchemaChanges?.nodes).toMatchInlineSnapshot(`
        [
          {
            approval: null,
            criticality: Dangerous,
            criticalityReason: The registry service url has changed,
            isSafeBasedOnUsage: false,
            message: [foo] New service url: 'https://api.com/products' (previously: 'https://api.com/nah'),
            path: null,
          },
        ]
      `);
      expect(compareResult?.target?.schemaVersion?.breakingSchemaChanges?.nodes).toBeUndefined();
    } finally {
      await pool?.end();
    }
  },
);

test.concurrent(
  'publishing schema with a deprecated "github: false" should be successful',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Single);
    const readWriteToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
    });

    const result = await readWriteToken
      .publishSchema({
        sdl: /* GraphQL */ `
          type Query {
            ping: String
          }
        `,
        github: false,
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');
  },
);

test.concurrent(
  'publishing Federation schema results in tags stored on the schema version',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, setFeatureFlag } = await createOrg();
    const { createToken, setNativeFederation } = await createProject(ProjectType.Federation);
    await setNativeFederation(true);
    await setFeatureFlag('compareToPreviousComposableVersion', true);

    const readWriteToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
    });

    const result = await readWriteToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            ping: String @tag(name: "atarashii")
          }
        `,
        service: 'foo',
        url: 'http://lol.de',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');
    const latestValidSchema = await readWriteToken.fetchLatestValidSchema();
    expect(latestValidSchema.latestValidVersion?.tags).toEqual(['atarashii']);
  },
);

test.concurrent('CDN services are published in alphanumeric order', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Stitching);
  const readWriteToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    projectScopes: [],
    organizationScopes: [],
  });

  await readWriteToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping1: String
        }
      `,
      service: 'z',
      url: 'http://z.foo',
    })
    .then(r => r.expectNoGraphQLErrors());

  await readWriteToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping2: String
        }
      `,
      service: 'x',
      url: 'http://x.foo',
    })
    .then(r => r.expectNoGraphQLErrors());

  await readWriteToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping3: String
        }
      `,
      service: 'y',
      url: 'http://y.foo',
    })
    .then(r => r.expectNoGraphQLErrors());

  const cdn = await readWriteToken.createCdnAccess();
  const res = await fetch(cdn.cdnUrl + '/services', {
    method: 'GET',
    headers: {
      'X-Hive-CDN-Key': cdn.secretAccessToken,
    },
  });

  expect(res.status).toBe(200);
  const result = await res.json();
  expect(result).toMatchObject([{ name: 'x' }, { name: 'y' }, { name: 'z' }]);
});

test.concurrent(
  'Composite schema project publish without service name results in error',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Federation);
    const readWriteToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
    });

    const result = await readWriteToken
      .publishSchema({
        sdl: /* GraphQL */ `
          type Query {
            ping: String
          }
        `,
        url: 'http://example.localhost',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(result).toEqual({
      schemaPublish: {
        __typename: 'SchemaPublishMissingServiceError',
      },
    });
  },
);

test.concurrent(
  'Composite schema project publish without service url results in error',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Federation);
    const readWriteToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
    });

    const result = await readWriteToken
      .publishSchema({
        sdl: /* GraphQL */ `
          type Query {
            ping: String
          }
        `,
        service: 'example',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(result).toEqual({
      schemaPublish: {
        __typename: 'SchemaPublishMissingUrlError',
      },
    });
  },
);

describe.concurrent(
  'schema publish should be ignored due to unchanged input schema and being compared to latest schema version',
  () => {
    test.concurrent('native federation', async () => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject, setFeatureFlag } = await createOrg();
      const { createToken, setNativeFederation } = await createProject(ProjectType.Federation);
      await setFeatureFlag('compareToPreviousComposableVersion', true);
      await setNativeFederation(true);

      const token = await createToken({
        targetScopes: [
          TargetAccessScope.Read,
          TargetAccessScope.RegistryRead,
          TargetAccessScope.RegistryWrite,
          TargetAccessScope.Settings,
        ],
      });

      const validSdl = /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          ping: String
          pong: String
          foo: User
        }

        type User {
          id: ID!
        }
      `;

      // here we use @tag without an argument to trigger a validation/composition error
      const invalidSdl = /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          ping: String
          pong: String
          foo: User @tag
        }

        type User {
          id: ID!
        }
      `;

      // Publish schema with write rights
      const validPublish = await token
        .publishSchema({
          sdl: validSdl,
          service: 'serviceA',
          url: 'http://localhost:4000',
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(validPublish.schemaPublish).toMatchObject({
        valid: true,
        linkToWebsite: expect.any(String),
      });

      const invalidPublish = await token
        .publishSchema({
          sdl: invalidSdl,
          service: 'serviceA',
          url: 'http://localhost:4000',
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(invalidPublish.schemaPublish).toMatchObject({
        valid: false,
        linkToWebsite: expect.any(String),
      });

      const invalidSdlCheck = await token
        .checkSchema(invalidSdl, 'serviceA')
        .then(r => r.expectNoGraphQLErrors());

      expect(invalidSdlCheck.schemaCheck).toMatchObject({
        valid: false,
        __typename: 'SchemaCheckError',
        changes: expect.objectContaining({
          total: 0,
        }),
        errors: expect.objectContaining({
          total: 1,
        }),
      });

      const validSdlCheck = await token
        .checkSchema(validSdl, 'serviceA')
        .then(r => r.expectNoGraphQLErrors());

      expect(validSdlCheck.schemaCheck).toMatchObject({
        valid: true,
        __typename: 'SchemaCheckSuccess',
        changes: expect.objectContaining({
          total: 0,
        }),
      });

      const result = await token
        .publishSchema({
          sdl: validSdl,
          service: 'serviceA',
          url: 'http://localhost:4000',
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(result.schemaPublish).toMatchObject({
        valid: true,
        linkToWebsite: expect.any(String),
      });

      if (
        !('linkToWebsite' in result.schemaPublish) ||
        !('linkToWebsite' in invalidPublish.schemaPublish) ||
        !('linkToWebsite' in validPublish.schemaPublish)
      ) {
        throw new Error('linkToWebsite not found');
      }

      // If the linkToWebsite is the same as one of the previous versions,
      // the schema publish was ignored due to unchanged input schemas.
      // It shouldn't be the case.
      // That's what we're checking here.

      expect(result.schemaPublish.linkToWebsite).not.toEqual(
        invalidPublish.schemaPublish.linkToWebsite,
      );

      expect(result.schemaPublish.linkToWebsite).not.toEqual(
        validPublish.schemaPublish.linkToWebsite,
      );

      const ignoredResult = await token
        .publishSchema({
          sdl: validSdl,
          service: 'serviceA',
          url: 'http://localhost:4000',
        })
        .then(r => r.expectNoGraphQLErrors());

      // This time the schema publish should be ignored
      // and link to the previous version
      expect(ignoredResult.schemaPublish).toMatchObject({
        valid: true,
        linkToWebsite: result.schemaPublish.linkToWebsite,
      });
    });

    test.concurrent('legacy fed composition', async () => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject, setFeatureFlag } = await createOrg();
      const { createToken, setNativeFederation } = await createProject(ProjectType.Federation);
      await setFeatureFlag('compareToPreviousComposableVersion', false);
      await setNativeFederation(false);

      const token = await createToken({
        targetScopes: [
          TargetAccessScope.Read,
          TargetAccessScope.RegistryRead,
          TargetAccessScope.RegistryWrite,
          TargetAccessScope.Settings,
        ],
      });

      const validSdl = /* GraphQL */ `
        type Query {
          ping: String
          pong: String
          foo: User
        }

        type User @key(fields: "id") {
          id: ID!
        }
      `;

      // @key(fields:) is invalid - should trigger a composition error
      const invalidSdl = /* GraphQL */ `
        type Query {
          ping: String
          pong: String
          foo: User
        }

        type User @key(fields: "uuid") {
          id: ID!
        }
      `;

      // Publish schema with write rights
      const validPublish = await token
        .publishSchema({
          sdl: validSdl,
          service: 'serviceA',
          url: 'http://localhost:4000',
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(validPublish.schemaPublish).toMatchObject({
        valid: true,
        linkToWebsite: expect.any(String),
      });

      const invalidPublish = await token
        .publishSchema({
          sdl: invalidSdl,
          service: 'serviceA',
          url: 'http://localhost:4000',
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(invalidPublish.schemaPublish).toMatchObject({
        valid: false,
        linkToWebsite: expect.any(String),
      });

      const invalidSdlCheck = await token
        .checkSchema(invalidSdl, 'serviceA')
        .then(r => r.expectNoGraphQLErrors());

      expect(invalidSdlCheck.schemaCheck).toMatchObject({
        valid: false,
        __typename: 'SchemaCheckError',
        changes: expect.objectContaining({
          total: 0,
        }),
        errors: expect.objectContaining({
          total: 1,
        }),
      });

      const validSdlCheck = await token
        .checkSchema(validSdl, 'serviceA')
        .then(r => r.expectNoGraphQLErrors());

      expect(validSdlCheck.schemaCheck).toMatchObject({
        valid: true,
        __typename: 'SchemaCheckSuccess',
        changes: expect.objectContaining({
          total: 0,
        }),
      });

      const result = await token
        .publishSchema({
          sdl: validSdl,
          service: 'serviceA',
          url: 'http://localhost:4000',
        })
        .then(r => r.expectNoGraphQLErrors());

      expect(result.schemaPublish).toMatchObject({
        valid: true,
        linkToWebsite: expect.any(String),
      });

      if (
        !('linkToWebsite' in result.schemaPublish) ||
        !('linkToWebsite' in invalidPublish.schemaPublish) ||
        !('linkToWebsite' in validPublish.schemaPublish)
      ) {
        throw new Error('linkToWebsite not found');
      }

      // If the linkToWebsite is the same as one of the previous versions,
      // the schema publish was ignored due to unchanged input schemas.
      // It shouldn't be the case.
      // That's what we're checking here.

      expect(result.schemaPublish.linkToWebsite).not.toEqual(
        invalidPublish.schemaPublish.linkToWebsite,
      );

      expect(result.schemaPublish.linkToWebsite).not.toEqual(
        validPublish.schemaPublish.linkToWebsite,
      );

      const ignoredResult = await token
        .publishSchema({
          sdl: validSdl,
          service: 'serviceA',
          url: 'http://localhost:4000',
        })
        .then(r => r.expectNoGraphQLErrors());

      // This time the schema publish should be ignored
      // and link to the previous version
      expect(ignoredResult.schemaPublish).toMatchObject({
        valid: true,
        linkToWebsite: result.schemaPublish.linkToWebsite,
      });
    });

    test.concurrent(
      'legacy fed composition with compareToPreviousComposableVersion=true',
      async () => {
        const { createOrg } = await initSeed().createOwner();
        const { createProject, setFeatureFlag } = await createOrg();
        const { createToken, setNativeFederation } = await createProject(ProjectType.Federation);
        await setFeatureFlag('compareToPreviousComposableVersion', true);
        await setNativeFederation(false);

        const token = await createToken({
          targetScopes: [
            TargetAccessScope.Read,
            TargetAccessScope.RegistryRead,
            TargetAccessScope.RegistryWrite,
            TargetAccessScope.Settings,
          ],
        });

        const validSdl = /* GraphQL */ `
          type Query {
            ping: String
            pong: String
            foo: User
          }

          type User @key(fields: "id") {
            id: ID!
          }
        `;

        // @key(fields:) is invalid - should trigger a composition error
        const invalidSdl = /* GraphQL */ `
          type Query {
            ping: String
            pong: String
            foo: User
          }

          type User @key(fields: "uuid") {
            id: ID!
          }
        `;

        // Publish schema with write rights
        const validPublish = await token
          .publishSchema({
            sdl: validSdl,
            service: 'serviceA',
            url: 'http://localhost:4000',
          })
          .then(r => r.expectNoGraphQLErrors());

        expect(validPublish.schemaPublish).toMatchObject({
          valid: true,
          linkToWebsite: expect.any(String),
        });

        const invalidPublish = await token
          .publishSchema({
            sdl: invalidSdl,
            service: 'serviceA',
            url: 'http://localhost:4000',
          })
          .then(r => r.expectNoGraphQLErrors());

        expect(invalidPublish.schemaPublish).toMatchObject({
          valid: false,
          linkToWebsite: expect.any(String),
        });

        const invalidSdlCheck = await token
          .checkSchema(invalidSdl, 'serviceA')
          .then(r => r.expectNoGraphQLErrors());

        expect(invalidSdlCheck.schemaCheck).toMatchObject({
          valid: false,
          __typename: 'SchemaCheckError',
          changes: expect.objectContaining({
            total: 0,
          }),
          errors: expect.objectContaining({
            total: 1,
          }),
        });

        const validSdlCheck = await token
          .checkSchema(validSdl, 'serviceA')
          .then(r => r.expectNoGraphQLErrors());

        expect(validSdlCheck.schemaCheck).toMatchObject({
          valid: true,
          __typename: 'SchemaCheckSuccess',
          changes: expect.objectContaining({
            total: 0,
          }),
        });

        const result = await token
          .publishSchema({
            sdl: validSdl,
            service: 'serviceA',
            url: 'http://localhost:4000',
          })
          .then(r => r.expectNoGraphQLErrors());

        expect(result.schemaPublish).toMatchObject({
          valid: true,
          linkToWebsite: expect.any(String),
        });

        if (
          !('linkToWebsite' in result.schemaPublish) ||
          !('linkToWebsite' in invalidPublish.schemaPublish) ||
          !('linkToWebsite' in validPublish.schemaPublish)
        ) {
          throw new Error('linkToWebsite not found');
        }

        // If the linkToWebsite is the same as one of the previous versions,
        // the schema publish was ignored due to unchanged input schemas.
        // It shouldn't be the case.
        // That's what we're checking here.

        expect(result.schemaPublish.linkToWebsite).not.toEqual(
          invalidPublish.schemaPublish.linkToWebsite,
        );

        expect(result.schemaPublish.linkToWebsite).not.toEqual(
          validPublish.schemaPublish.linkToWebsite,
        );

        const ignoredResult = await token
          .publishSchema({
            sdl: validSdl,
            service: 'serviceA',
            url: 'http://localhost:4000',
          })
          .then(r => r.expectNoGraphQLErrors());

        // This time the schema publish should be ignored
        // and link to the previous version
        expect(ignoredResult.schemaPublish).toMatchObject({
          valid: true,
          linkToWebsite: result.schemaPublish.linkToWebsite,
        });
      },
    );
  },
);

test.concurrent(
  'publishing schema with deprecated non-nullable input field fails due to validation errors',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Single);
    const token = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    const sdl = /* GraphQL */ `
      type Query {
        a(b: B!): String
      }

      input B {
        a: String! @deprecated(reason: "This field is deprecated")
        b: String!
      }
    `;

    const result = await token
      .publishSchema({
        sdl,
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(result.schemaPublish).toEqual({
      __typename: 'SchemaPublishError',
      changes: {
        nodes: [],
        total: 0,
      },
      errors: {
        nodes: [
          {
            message: 'Required input field B.a cannot be deprecated.',
          },
        ],
        total: 1,
      },
      linkToWebsite: null,
      valid: false,
    });
  },
);

test.concurrent(
  'publishing a valid schema onto a broken schema succeeds (prior schema has deprecated non-nullable input)',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createToken, project, target } = await createProject(ProjectType.Single);
    const token = await createToken({
      targetScopes: [
        TargetAccessScope.Read,
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    const brokenSdl = /* GraphQL */ `
      type Query {
        a(b: B!): String
      }

      input B {
        a: String! @deprecated(reason: "This field is deprecated")
        b: String!
      }
    `;

    // we need to manually insert a broken schema version into the database
    // as we fixed the issue that allows publishing such a broken version

    const conn = connectionString();
    const storage = await createStorage(conn, 2);
    await storage.createVersion({
      schema: brokenSdl,
      author: 'Jochen',
      async actionFn() {},
      base_schema: null,
      commit: '123',
      changes: [],
      compositeSchemaSDL: null,
      conditionalBreakingChangeMetadata: null,
      contracts: null,
      coordinatesDiff: null,
      diffSchemaVersionId: null,
      github: null,
      metadata: null,
      logIds: [],
      project: project.id,
      service: null,
      organization: organization.id,
      previousSchemaVersion: null,
      valid: true,
      schemaCompositionErrors: [],
      supergraphSDL: null,
      tags: null,
      target: target.id,
      url: null,
    });
    await storage.destroy();

    const validSdl = /* GraphQL */ `
      type Query {
        a(b: B!): String
      }

      input B {
        a: String @deprecated(reason: "This field is deprecated")
        b: String!
      }
    `;

    const result = await token
      .publishSchema({
        sdl: validSdl,
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(result.schemaPublish).toEqual({
      __typename: 'SchemaPublishSuccess',
      changes: null,
      initial: false,
      linkToWebsite: expect.any(String),
      message: '',
      valid: true,
    });
  },
);
