import { ProjectType, RegistryModel, TargetAccessScope } from '@app/gql/graphql';
import { createCLI } from '../../testkit/cli';
import { prepareProject } from '../../testkit/registry-models';
import { initSeed } from '../../testkit/seed';

describe('publish', () => {
  test.concurrent('accepted: composable', async () => {
    const { publish } = await prepare();
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProductName: String
        }
      `,
      expect: 'latest-composable',
    });
  });

  test.concurrent('rejected: not composable (initial)', async () => {
    const { publish } = await prepare();
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProductName: Product
        }
      `,
      expect: 'rejected',
    });
  });

  test.concurrent('partially accepted: not composable (force)', async () => {
    const { publish } = await prepare();
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProductName: Product
        }
      `,
      legacy_force: true,
      expect: 'latest',
    });
  });

  test.concurrent('rejected: composable, breaking changes', async () => {
    const { publish } = await prepare();
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProductName: String
        }
      `,
      expect: 'latest-composable',
    });

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          nooooo: String
        }
      `,
      expect: 'rejected',
    });
  });

  test.concurrent('accepted: composable, breaking changes (acceptBreakingChanges)', async () => {
    const { publish } = await prepare();
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProductName: String
        }
      `,
      expect: 'latest-composable',
    });

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          nooooo: String
        }
      `,
      legacy_acceptBreakingChanges: true,
      expect: 'latest-composable',
    });
  });

  test.concurrent('partially accepted: composable, breaking changes (force)', async () => {
    const { publish } = await prepare();
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProductName: String
        }
      `,
      expect: 'latest-composable',
    });

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          nooooo: String
        }
      `,
      legacy_force: true,
      expect: 'latest',
    });
  });

  test.concurrent('accepted (ignored): composable, no changes', async () => {
    const { publish } = await prepare();

    // composable
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      expect: 'latest-composable',
    });

    // composable but no changes
    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      expect: 'ignored',
    });
  });

  test.concurrent('CLI output', async ({ expect }) => {
    const { publish } = await prepare();

    await expect(
      publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: Product
          }

          type Product {
            id: ID!
            name: String!
          }
        `,
        expect: 'latest-composable',
      }),
    ).resolves.toMatchInlineSnapshot(`
      v Published initial schema.
      i Available at http://localhost:8080/$organization/$project/production
    `);

    await expect(
      publish({
        sdl: /* GraphQL */ `
          type Query {
            topProduct: Product
          }

          type Product {
            id: ID!
            name: String!
            price: Int!
          }
        `,
        expect: 'latest-composable',
      }),
    ).resolves.toMatchInlineSnapshot(`
      i Detected 1 change
      Safe changes:
      - Field price was added to object type Product
      v Schema published
      i Available at http://localhost:8080/$organization/$project/production/history/$version
    `);
  });
});

describe('check', () => {
  test.concurrent('accepted: composable, no breaking changes', async () => {
    const { publish, check } = await prepare();

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      expect: 'latest-composable',
    });

    const message = await check({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
          topProductName: String
        }
      `,
      expect: 'approved',
    });

    expect(message).toMatch('topProductName');
  });

  test.concurrent('accepted: no changes', async () => {
    const { publish, check } = await prepare();

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      expect: 'latest-composable',
    });

    await check({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      expect: 'approved',
    });
  });

  test.concurrent('rejected: composable, breaking changes', async () => {
    const { publish, check } = await prepare();

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      expect: 'latest-composable',
    });

    const message = await check({
      sdl: /* GraphQL */ `
        type Query {
          topProductName: String
        }
      `,
      expect: 'rejected',
    });

    expect(message).toMatch('removed');
  });

  test.concurrent('rejected: not composable, no breaking changes', async () => {
    const { publish, check } = await prepare();

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
        }
      `,
      expect: 'latest-composable',
    });

    const message = await check({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: String
          topProductName: Strin
        }
      `,
      expect: 'rejected',
    });

    expect(message).toMatch('Strin');
  });

  test.concurrent('rejected: not composable, breaking changes', async () => {
    const { publish, check } = await prepare();

    await publish({
      sdl: /* GraphQL */ `
        type Query {
          topProduct: Product
        }
        type Product {
          id: ID!
          name: String
        }
      `,
      expect: 'latest-composable',
    });

    const message = await check({
      sdl: /* GraphQL */ `
        type Query {
          product(id: ID!): Product
        }
        type Product {
          id: ID!
          name: Str
        }
      `,
      expect: 'rejected',
    });

    expect(message).toMatch('Str');
  });
});

describe('delete', () => {
  test.concurrent('not supported', async () => {
    const cli = await prepare();

    await cli.delete({
      serviceName: 'test',
      expect: 'rejected',
    });
  });
});

describe('other', () => {
  test.concurrent('marking versions as valid', async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(ProjectType.Single, {
      useLegacyRegistryModels: true,
    });
    const { publishSchema, fetchVersions, fetchLatestValidSchema, updateSchemaVersionStatus } =
      await createToken({
        organizationScopes: [],
        projectScopes: [],
        targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      });

    // Initial schema
    let result = await publishSchema({
      author: 'Kamil',
      commit: 'c0',
      sdl: `type Query { ping: String }`,
    }).then(r => r.expectNoGraphQLErrors());

    expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // Second version with a forced breaking change
    result = await publishSchema({
      author: 'Kamil',
      commit: 'c1',
      sdl: `type Query { pong: String }`,
      force: true,
      metadata: JSON.stringify({ c1: true }),
    }).then(r => r.expectNoGraphQLErrors());

    // third version with another forced breaking change
    result = await publishSchema({
      author: 'Kamil',
      commit: 'c2',
      sdl: `type Query { tennis: String }`,
      force: true,
      metadata: JSON.stringify({ c2: true }),
    }).then(r => r.expectNoGraphQLErrors());

    const versions = await fetchVersions(3);

    expect(versions).toHaveLength(3);

    // the initial version should be the latest valid version
    let latestValidSchemaResult = await fetchLatestValidSchema();
    expect(latestValidSchemaResult.latestValidVersion?.schemas.total).toEqual(1);
    expect(latestValidSchemaResult.latestValidVersion?.schemas.nodes[0]).toEqual(
      expect.objectContaining({
        commit: 'c0',
      }),
    );

    const versionId = (commit: string) =>
      versions.find(node => 'commit' in node.log && node.log.commit === commit)!.id;

    // marking the third version as valid should promote it to be the latest valid version
    let versionStatusUpdateResult = await updateSchemaVersionStatus(versionId('c2'), true);

    expect(versionStatusUpdateResult.updateSchemaVersionStatus.id).toEqual(versionId('c2'));

    latestValidSchemaResult = await fetchLatestValidSchema();
    expect(latestValidSchemaResult.latestValidVersion?.id).toEqual(versionId('c2'));

    // marking the second (not the most recent) version as valid should NOT promote it to be the latest valid version
    versionStatusUpdateResult = await updateSchemaVersionStatus(versionId('c1'), true);

    latestValidSchemaResult = await fetchLatestValidSchema();
    expect(latestValidSchemaResult.latestValidVersion?.id).toEqual(versionId('c2'));
  });

  test.concurrent(
    'marking only the most recent version as valid result in an update of CDN',
    async () => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createToken } = await createProject(ProjectType.Single, {
        useLegacyRegistryModels: true,
      });
      const {
        publishSchema,
        fetchVersions,
        updateSchemaVersionStatus,
        fetchSchemaFromCDN,
        fetchMetadataFromCDN,
      } = await createToken({
        organizationScopes: [],
        projectScopes: [],
        targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      });

      // Initial schema
      let result = await publishSchema({
        author: 'Kamil',
        commit: 'c0',
        sdl: `type Query { ping: String }`,
        metadata: JSON.stringify({ c0: 1 }),
      }).then(r => r.expectNoGraphQLErrors());

      expect(result.schemaPublish.__typename).toBe('SchemaPublishSuccess');

      // Second version with a forced breaking change
      result = await publishSchema({
        author: 'Kamil',
        commit: 'c1',
        sdl: `type Query { pong: String }`,
        force: true,
        metadata: JSON.stringify({ c1: 1 }),
      }).then(r => r.expectNoGraphQLErrors());

      // third version with another forced breaking change
      result = await publishSchema({
        author: 'Kamil',
        commit: 'c2',
        sdl: `type Query { tennis: String }`,
        force: true,
        metadata: JSON.stringify({ c2: 1 }),
      }).then(r => r.expectNoGraphQLErrors());

      // the initial version should available on CDN
      let cdnResult = await fetchSchemaFromCDN();
      expect(cdnResult.body).toContain('ping');

      let cdnMetadataResult = await fetchMetadataFromCDN();
      expect(cdnMetadataResult.status).toEqual(200);
      expect(cdnMetadataResult.body).toEqual({ c0: 1 });

      const versions = await fetchVersions(3);

      const versionId = (commit: string) =>
        versions.find(node => 'commit' in node.log && node.log.commit === commit)!.id;

      // marking the third version as valid should promote it to be the latest valid version and publish it to CDN
      await updateSchemaVersionStatus(versionId('c2'), true);

      cdnResult = await fetchSchemaFromCDN();
      expect(cdnResult.body).toContain('tennis');

      cdnMetadataResult = await fetchMetadataFromCDN();
      expect(cdnMetadataResult.status).toEqual(200);
      expect(cdnMetadataResult.body).toEqual({ c2: 1 });

      // marking the second (not the most recent) version as valid should NOT promote it to be the latest valid version
      await updateSchemaVersionStatus(versionId('c1'), true);

      cdnResult = await fetchSchemaFromCDN();
      expect(cdnResult.body).toContain('tennis');

      cdnMetadataResult = await fetchMetadataFromCDN();
      expect(cdnMetadataResult.status).toEqual(200);
      expect(cdnMetadataResult.body).toEqual({ c2: 1 });
    },
  );
});

async function prepare() {
  const { tokens } = await prepareProject(ProjectType.Single, RegistryModel.Legacy);

  return createCLI(tokens.registry);
}
