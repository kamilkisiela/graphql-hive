import { ProjectType, TargetAccessScope } from '@app/gql/graphql';
import { graphql } from '../../../testkit/gql';
import { execute } from '../../../testkit/graphql';
import { initSeed } from '../../../testkit/seed';

const CreateContractMutation = graphql(`
  mutation CreateContractMutation1($input: CreateContractInput!) {
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
          userSpecifiedContractId
          includeTags
          excludeTags
        }
      }
    }
  }
`);

test.concurrent('schema check with successful contract checks', async ({ expect }) => {
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
  const publishResult = await writeToken
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

  // Schema publish should be successful
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        targetId: target.id,
        userSpecifiedContractId: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        excludeTags: ['toyota'],
      },
    },
    authToken: writeToken.secret,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  // Check schema with no read and write rights
  const checkResult = await writeToken
    .checkSchema(
      /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          meh: String!
          mehHidden: String @tag(name: "toyota")
        }
      `,
      'meh',
    )
    .then(r => r.expectNoGraphQLErrors());
  expect(checkResult.schemaCheck.__typename).toBe('SchemaCheckSuccess');
});

test.concurrent('schema check with failing contract composition', async ({ expect }) => {
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
  const publishResult = await writeToken
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

  // Schema publish should be successful
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  const createContractResult = await execute({
    document: CreateContractMutation,
    variables: {
      input: {
        targetId: target.id,
        userSpecifiedContractId: 'my-contract',
        removeUnreachableTypesFromPublicApiSchema: true,
        excludeTags: ['toyota'],
      },
    },
    authToken: writeToken.secret,
  }).then(r => r.expectNoGraphQLErrors());

  expect(createContractResult.createContract.error).toBeNull();

  // Check schema with no read and write rights
  const checkResult = await writeToken
    .checkSchema(
      /* GraphQL */ `
        extend schema
          @link(url: "https://specs.apollo.dev/link/v1.0")
          @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

        type Query {
          meh: String! @tag(name: "toyota")
          mehHidden: String @tag(name: "toyota")
        }
      `,
      'meh',
    )
    .then(r => r.expectNoGraphQLErrors());

  expect(checkResult.schemaCheck.__typename).toBe('SchemaCheckError');
  if (checkResult.schemaCheck.__typename !== 'SchemaCheckError') {
    throw new Error(`Expected SchemaCheckError, got ${checkResult.schemaCheck.__typename}`);
  }

  expect(checkResult.schemaCheck.errors?.nodes).toMatchInlineSnapshot(`
    [
      {
        message: [my-contract] Type "Query" is in the API schema but all of its fields are @inaccessible.,
      },
    ]
  `);
});

test.concurrent(
  'schema check with failing contract composition (multiple contracts)',
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
    const publishResult = await writeToken
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

    // Schema publish should be successful
    expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    let createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          targetId: target.id,
          userSpecifiedContractId: 'my-contract',
          removeUnreachableTypesFromPublicApiSchema: true,
          excludeTags: ['toyota'],
        },
      },
      authToken: writeToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    createContractResult = await execute({
      document: CreateContractMutation,
      variables: {
        input: {
          targetId: target.id,
          userSpecifiedContractId: 'my-other-contract',
          removeUnreachableTypesFromPublicApiSchema: true,
          includeTags: ['fiat'],
        },
      },
      authToken: writeToken.secret,
    }).then(r => r.expectNoGraphQLErrors());

    expect(createContractResult.createContract.error).toBeNull();

    // Check schema with no read and write rights
    const checkResult = await writeToken
      .checkSchema(
        /* GraphQL */ `
          extend schema
            @link(url: "https://specs.apollo.dev/link/v1.0")
            @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])

          type Query {
            meh: String! @tag(name: "toyota")
            mehHidden: String @tag(name: "toyota")
          }
        `,
        'meh',
      )
      .then(r => r.expectNoGraphQLErrors());

    expect(checkResult.schemaCheck.__typename).toBe('SchemaCheckError');

    if (checkResult.schemaCheck.__typename !== 'SchemaCheckError') {
      throw new Error(`Expected SchemaCheckError, got ${checkResult.schemaCheck.__typename}`);
    }

    expect(checkResult.schemaCheck.errors?.nodes).toMatchInlineSnapshot(`
    [
      {
        message: [my-contract] Type "Query" is in the API schema but all of its fields are @inaccessible.,
      },
      {
        message: [my-other-contract] Type "Query" is in the API schema but all of its fields are @inaccessible.,
      },
    ]
  `);
  },
);
