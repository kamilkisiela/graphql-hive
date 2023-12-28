import { ProjectType, TargetAccessScope } from '@app/gql/graphql';
import { graphql } from '../../../testkit/gql';
import { execute } from '../../../testkit/graphql';
import { initSeed } from '../../../testkit/seed';

const CreateContractMutation = graphql(`
  mutation CreateContractMutation2($input: CreateContractInput!) {
    createContract(input: $input) {
      ok {
        createdContract {
          id
          target {
            id
          }
          includeTags
          excludeTags
          createdAt
        }
      }
      error {
        message
        details {
          targetId
          contractName
          includeTags
          excludeTags
        }
      }
    }
  }
`);

test.concurrent(
  'schema publish with successful initial contract composition',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, setFeatureFlag } = await createOrg();
    const { createToken, target, setNativeFederation } = await createProject(
      ProjectType.Federation,
    );
    await setFeatureFlag('compareToPreviousComposableVersion', true);
    await setNativeFederation(true);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [
        TargetAccessScope.RegistryRead,
        TargetAccessScope.RegistryWrite,
        TargetAccessScope.Settings,
      ],
    });

    // Publish schema with write rights
    let publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            hello: String
            helloHidden: String @tag(name: "toyota")
          }
        `,
        service: 'hello',
        url: 'http://hello.com',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    const createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          targetId: target.id,
          contractName: 'my-contract',
          removeUnreachableTypesFromPublicApiSchema: true,
          includeTags: ['toyota'],
        },
      },
      authToken: writeToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    // Publish schema with write rights
    publishResult = await writeToken
      .publishSchema({
        sdl: /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            hello: String
            helloHidden: String @tag(name: "toyota")
            foo: String
          }
        `,
        service: 'hello',
        url: 'http://hello.com',
      })
      .then(r => r.expectNoGraphQLErrors());

    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
  },
);

test.concurrent('schema publish with failing initial contract composition', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  const { createToken, target, setNativeFederation } = await createProject(ProjectType.Federation);
  await setFeatureFlag('compareToPreviousComposableVersion', true);
  await setNativeFederation(true);

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  // Publish schema with write rights
  let publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String @tag(name: "toyota")
          helloHidden: String @tag(name: "toyota")
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        targetId: target.id,
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        excludeTags: ['toyota'],
      },
    },
    authToken: writeToken.secret,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  // Publish schema with write rights
  publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String @tag(name: "toyota")
          helloHidden: String @tag(name: "toyota")
          foo: String @tag(name: "toyota")
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
});

test.concurrent('schema publish with succeeding contract composition', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  const { createToken, target, setNativeFederation } = await createProject(ProjectType.Federation);
  await setFeatureFlag('compareToPreviousComposableVersion', true);
  await setNativeFederation(true);

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        targetId: target.id,
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        includeTags: ['toyota'],
      },
    },
    authToken: writeToken.secret,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  // Publish schema with write rights
  let publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String @tag(name: "toyota")
          helloHidden: String
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String @tag(name: "toyota")
          helloHidden: String
          bar: String @tag(name: "toyota")
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
});

test.concurrent('schema publish with failing contract composition', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  const { createToken, target, setNativeFederation } = await createProject(ProjectType.Federation);
  await setFeatureFlag('compareToPreviousComposableVersion', true);
  await setNativeFederation(true);

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [
      TargetAccessScope.RegistryRead,
      TargetAccessScope.RegistryWrite,
      TargetAccessScope.Settings,
    ],
  });

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        targetId: target.id,
        contractName: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        excludeTags: ['toyota'],
      },
    },
    authToken: writeToken.secret,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  // Publish schema with write rights
  let publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String @tag(name: "toyota")
          helloHidden: String
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          hello: String @tag(name: "toyota")
          helloHidden: String @tag(name: "toyota")
          bar: String @tag(name: "toyota")
        }
      `,
      service: 'hello',
      url: 'http://hello.com',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
});
