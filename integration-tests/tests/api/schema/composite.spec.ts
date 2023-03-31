import { ProjectType, TargetAccessScope } from '@app/gql/graphql';
import { initSeed } from '../../../testkit/seed';

describe.each`
  projectType               | model
  ${ProjectType.Stitching}  | ${'modern'}
  ${ProjectType.Federation} | ${'modern'}
  ${ProjectType.Stitching}  | ${'legacy'}
  ${ProjectType.Federation} | ${'legacy'}
`('$projectType ($model)', ({ projectType, model }) => {
  test.concurrent('should insert lowercase service name to DB', async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject } = await createOrg();
    const { createToken } = await createProject(projectType, {
      useLegacyRegistryModels: model === 'legacy',
    });
    const { publishSchema, checkSchema, deleteSchema, fetchVersions } = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [],
      organizationScopes: [],
    });

    const firstSdl = /* GraphQL */ `
      type Query {
        topProduct: Product
      }

      type Product {
        id: ID!
        name: String
      }
    `;

    await publishSchema({
      author: 'Kamil',
      commit: 'abc123',
      sdl: firstSdl,
      service: 'MyService', // PascalCase
      url: 'http://localhost:4000',
    }).then(r => r.expectNoGraphQLErrors());

    await expect(fetchVersions(2)).resolves.toHaveLength(1);

    await publishSchema({
      author: 'Kamil',
      commit: 'abc123',
      sdl: firstSdl,
      service: 'myService', // camelCase
      url: 'http://localhost:4000',
    }).then(r => r.expectNoGraphQLErrors());

    await expect(fetchVersions(2)).resolves.toHaveLength(1);

    await expect(
      checkSchema(
        firstSdl,
        'myService', // camelCase
      ).then(r => r.expectNoGraphQLErrors()),
    ).resolves.toEqual(
      expect.objectContaining({
        schemaCheck: {
          __typename: 'SchemaCheckSuccess',
          valid: true,
          changes: {
            nodes: [],
            total: 0,
          },
        },
      }),
    );

    const secondSdl = /* GraphQL */ `
      type Query {
        topReview: Review
      }

      type Review {
        id: ID!
        title: String
      }
    `;

    await publishSchema({
      author: 'Kamil',
      commit: 'abc1234',
      sdl: secondSdl,
      service: 'MyOtherService', // PascalCase
      url: 'http://localhost:5000',
    }).then(r => r.expectNoGraphQLErrors());

    // We should have 2 versions (push, push)
    const versionsBeforeDelete = await fetchVersions(3);
    expect(versionsBeforeDelete).toHaveLength(2);

    expect(versionsBeforeDelete).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          log: expect.objectContaining({
            service: 'myservice',
          }),
        }),
        expect.objectContaining({
          log: expect.objectContaining({
            service: 'myotherservice',
          }),
        }),
      ]),
    );

    if (model === 'legacy') {
      // Ignore the rest of the test for legacy models
      return;
    }

    await expect(
      deleteSchema(
        'myOtherService', // camelCase
      ).then(r => r.expectNoGraphQLErrors()),
    ).resolves.toEqual(
      expect.objectContaining({
        schemaDelete: expect.objectContaining({
          __typename: 'SchemaDeleteSuccess',
        }),
      }),
    );

    const versions = await fetchVersions(4);

    // We should have 3 versions (push, push, delete)
    expect(versions).toHaveLength(3);
    // Most recent version should be a delete action
    expect(versions[0].log).toEqual({
      __typename: 'DeletedSchemaLog',
      deletedService: 'myotherservice',
    });
  });
});

describe.each`
  projectType
  ${ProjectType.Stitching}
  ${ProjectType.Federation}
`('$projectType', ({ projectType }) => {
  test.concurrent(
    'should publish A, publish B, delete B, publish A and have A and B at the end',
    async () => {
      const { createOrg } = await initSeed().createOwner();
      const { createProject } = await createOrg();
      const { createToken } = await createProject(projectType);
      const { publishSchema, deleteSchema, fetchVersions, fetchLatestValidSchema } =
        await createToken({
          targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
          projectScopes: [],
          organizationScopes: [],
        });

      const serviceA = /* GraphQL */ `
        type Query {
          topProduct: Product
        }

        type Product {
          id: ID!
          name: String
        }
      `;

      const serviceB = /* GraphQL */ `
        type Query {
          topReview: Review
        }

        type Review {
          id: ID!
          title: String
        }
      `;

      await publishSchema({
        author: 'Kamil',
        commit: 'push1',
        sdl: serviceA,
        service: 'service-a',
        url: 'http://localhost:4001',
      }).then(r => r.expectNoGraphQLErrors());

      await expect(fetchVersions(2)).resolves.toHaveLength(1);

      await publishSchema({
        author: 'Kamil',
        commit: 'push2',
        sdl: serviceB,
        service: 'service-b',
        url: 'http://localhost:4002',
      }).then(r => r.expectNoGraphQLErrors());

      // We should have 2 versions (push, push)
      await expect(fetchVersions(3)).resolves.toHaveLength(2);

      await expect(deleteSchema('service-b').then(r => r.expectNoGraphQLErrors())).resolves.toEqual(
        expect.objectContaining({
          schemaDelete: expect.objectContaining({
            __typename: 'SchemaDeleteSuccess',
          }),
        }),
      );

      const versions = await fetchVersions(4);

      // We should have 3 versions (push, push, delete)
      expect(versions).toHaveLength(3);
      // Most recent version should be a delete action
      expect(versions[0].log).toEqual({
        __typename: 'DeletedSchemaLog',
        deletedService: 'service-b',
      });

      await publishSchema({
        author: 'Kamil',
        commit: 'push3',
        sdl: serviceB,
        service: 'service-b',
        url: 'http://localhost:4002',
      }).then(r => r.expectNoGraphQLErrors());

      // We should have 4 versions (push, push, delete, push)
      await expect(fetchVersions(5)).resolves.toHaveLength(4);

      const latestValid = await fetchLatestValidSchema();
      expect(latestValid.latestValidVersion).toBeDefined();
      expect(latestValid.latestValidVersion?.log.__typename).toEqual('PushedSchemaLog');
      expect(latestValid.latestValidVersion?.schemas.nodes).toHaveLength(2);
      expect(latestValid.latestValidVersion?.schemas.nodes).toContainEqual(
        expect.objectContaining({
          commit: 'push1',
        }),
      );
      expect(latestValid.latestValidVersion?.schemas.nodes).toContainEqual(
        expect.objectContaining({
          commit: 'push3',
        }),
      );
    },
  );
});
