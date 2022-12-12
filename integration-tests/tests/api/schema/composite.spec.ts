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
    await expect(fetchVersions(3)).resolves.toHaveLength(2);

    await expect(
      deleteSchema(
        'myOtherService', // camelCase
      ).then(r => r.expectNoGraphQLErrors()),
    ).resolves.toEqual(
      expect.objectContaining({
        schemaDelete: {
          __typename: 'SchemaDeleteSuccess',
        },
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
