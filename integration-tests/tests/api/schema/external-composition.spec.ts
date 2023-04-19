import { ProjectAccessScope, ProjectType, TargetAccessScope } from '@app/gql/graphql';
import { history, serviceName, servicePort } from '../../../testkit/external-composition';
import { enableExternalSchemaComposition } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';
import { generateUnique } from '../../../testkit/utils';

test.concurrent('call an external service to compose and validate services', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken, project } = await createProject(ProjectType.Federation);

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    projectScopes: [ProjectAccessScope.Settings, ProjectAccessScope.Read],
    organizationScopes: [],
  });

  const usersServiceName = generateUnique();
  const publishUsersResult = await writeToken
    .publishSchema({
      url: 'https://api.com/users',
      sdl: /* GraphQL */ `
        type Query {
          me: User
        }

        type User @key(fields: "id") {
          id: ID!
          name: String
        }
      `,
      service: usersServiceName,
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be successful
  expect(publishUsersResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // expect `users` service to be composed internally
  await expect(history()).resolves.not.toContainEqual(usersServiceName);

  // we use internal docker network to connect to the external composition service,
  // so we need to use the name and not resolved host
  const dockerAddress = `${serviceName}:${servicePort}`;
  // enable external composition
  const externalCompositionResult = await enableExternalSchemaComposition(
    {
      endpoint: `http://${dockerAddress}/compose`,
      // eslint-disable-next-line no-process-env
      secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
      project: project.cleanId,
      organization: organization.cleanId,
    },
    writeToken.secret,
  ).then(r => r.expectNoGraphQLErrors());
  expect(
    externalCompositionResult.enableExternalSchemaComposition.ok?.externalSchemaComposition
      ?.endpoint,
  ).toBe(`http://${dockerAddress}/compose`);

  const productsServiceName = generateUnique();
  const publishProductsResult = await writeToken
    .publishSchema({
      url: 'https://api.com/products',
      sdl: /* GraphQL */ `
        type Query {
          products: [Product]
        }
        type Product @key(fields: "id") {
          id: ID!
          name: String
        }
      `,
      service: productsServiceName,
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be successful
  expect(publishProductsResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // expect `products` service to be composed externally
  await expect(history()).resolves.toContainEqual(productsServiceName);
});

test.concurrent(
  'an expected error coming from the external composition service should be visible to the user',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createToken, project } = await createProject(ProjectType.Federation);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [ProjectAccessScope.Settings, ProjectAccessScope.Read],
      organizationScopes: [],
    });

    const usersServiceName = generateUnique();
    const publishUsersResult = await writeToken
      .publishSchema({
        url: 'https://api.com/users',
        sdl: /* GraphQL */ `
          type Query {
            me: User
          }

          type User @key(fields: "id") {
            id: ID!
            name: String
          }
        `,
        service: usersServiceName,
      })
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishUsersResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // expect `users` service to be composed internally
    await expect(history()).resolves.not.toContainEqual(usersServiceName);

    // we use internal docker network to connect to the external composition service,
    // so we need to use the name and not resolved host
    const dockerAddress = `${serviceName}:${servicePort}`;
    // enable external composition
    const externalCompositionResult = await enableExternalSchemaComposition(
      {
        endpoint: `http://${dockerAddress}/fail_on_signature`,
        // eslint-disable-next-line no-process-env
        secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
        project: project.cleanId,
        organization: organization.cleanId,
      },
      writeToken.secret,
    ).then(r => r.expectNoGraphQLErrors());
    expect(
      externalCompositionResult.enableExternalSchemaComposition.ok?.externalSchemaComposition
        ?.endpoint,
    ).toBe(`http://${dockerAddress}/fail_on_signature`);

    const productsServiceName = generateUnique();
    const publishProductsResult = await writeToken
      .publishSchema({
        url: 'https://api.com/products',
        sdl: /* GraphQL */ `
          type Query {
            products: [Product]
          }
          type Product @key(fields: "id") {
            id: ID!
            name: String
          }
        `,
        service: productsServiceName,
      })
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be unsuccessful and the error coming from the external composition service should be visible
    expect(publishProductsResult.schemaPublish).toEqual(
      expect.objectContaining({
        __typename: 'SchemaPublishError',
        changes: {
          total: 0,
          nodes: [],
        },
        errors: {
          total: 1,
          nodes: [
            {
              message: expect.stringContaining('(ERR_INVALID_SIGNATURE)'), // composition
            },
          ],
        },
      }),
    );
  },
);

test.concurrent(
  'a network error coming from the external composition service should be visible to the user',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createToken, project } = await createProject(ProjectType.Federation);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [ProjectAccessScope.Settings, ProjectAccessScope.Read],
      organizationScopes: [],
    });

    const usersServiceName = generateUnique();
    const publishUsersResult = await writeToken
      .publishSchema({
        url: 'https://api.com/users',
        sdl: /* GraphQL */ `
          type Query {
            me: User
          }

          type User @key(fields: "id") {
            id: ID!
            name: String
          }
        `,
        service: usersServiceName,
      })
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be successful
    expect(publishUsersResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

    // expect `users` service to be composed internally
    await expect(history()).resolves.not.toContainEqual(usersServiceName);

    // we use internal docker network to connect to the external composition service,
    // so we need to use the name and not resolved host
    const dockerAddress = `${serviceName}:${servicePort}`;
    // enable external composition
    const externalCompositionResult = await enableExternalSchemaComposition(
      {
        endpoint: `http://${dockerAddress}/non-existing-endpoint`,
        // eslint-disable-next-line no-process-env
        secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
        project: project.cleanId,
        organization: organization.cleanId,
      },
      writeToken.secret,
    ).then(r => r.expectNoGraphQLErrors());
    expect(
      externalCompositionResult.enableExternalSchemaComposition.ok?.externalSchemaComposition
        ?.endpoint,
    ).toBe(`http://${dockerAddress}/non-existing-endpoint`);

    const productsServiceName = generateUnique();
    const publishProductsResult = await writeToken
      .publishSchema({
        url: 'https://api.com/products',
        sdl: /* GraphQL */ `
          type Query {
            products: [Product]
          }
          type Product @key(fields: "id") {
            id: ID!
            name: String
          }
        `,
        service: productsServiceName,
      })
      .then(r => r.expectNoGraphQLErrors());

    // Schema publish should be unsuccessful and the error coming from the external composition service should be visible
    expect(publishProductsResult.schemaPublish).toEqual(
      expect.objectContaining({
        __typename: 'SchemaPublishError',
        changes: {
          total: 0,
          nodes: [],
        },
        errors: {
          total: 1,
          nodes: [
            {
              message: expect.stringContaining('404'), // composition
            },
          ],
        },
      }),
    );
  },
);

test.concurrent('a timeout error should be visible to the user', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken, project } = await createProject(ProjectType.Federation);

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    projectScopes: [ProjectAccessScope.Settings, ProjectAccessScope.Read],
    organizationScopes: [],
  });

  const usersServiceName = generateUnique();
  const publishUsersResult = await writeToken
    .publishSchema({
      url: 'https://api.com/users',
      sdl: /* GraphQL */ `
        type Query {
          me: User
        }

        type User @key(fields: "id") {
          id: ID!
          name: String
        }
      `,
      service: usersServiceName,
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be successful
  expect(publishUsersResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // expect `users` service to be composed internally
  await expect(history()).resolves.not.toContainEqual(usersServiceName);

  // we use internal docker network to connect to the external composition service,
  // so we need to use the name and not resolved host
  const dockerAddress = `${serviceName}:${servicePort}`;
  // enable external composition
  const externalCompositionResult = await enableExternalSchemaComposition(
    {
      endpoint: `http://${dockerAddress}/timeout`,
      // eslint-disable-next-line no-process-env
      secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
      project: project.cleanId,
      organization: organization.cleanId,
    },
    writeToken.secret,
  ).then(r => r.expectNoGraphQLErrors());
  expect(
    externalCompositionResult.enableExternalSchemaComposition.ok?.externalSchemaComposition
      ?.endpoint,
  ).toBe(`http://${dockerAddress}/timeout`);

  const productsServiceName = generateUnique();
  const publishProductsResult = await writeToken
    .publishSchema({
      url: 'https://api.com/products',
      sdl: /* GraphQL */ `
        type Query {
          products: [Product]
        }
        type Product @key(fields: "id") {
          id: ID!
          name: String
        }
      `,
      service: productsServiceName,
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be unsuccessful and the timeout error should be visible
  expect(publishProductsResult.schemaPublish).toEqual(
    expect.objectContaining({
      __typename: 'SchemaPublishError',
      changes: {
        total: 0,
        nodes: [],
      },
      errors: {
        total: 1,
        nodes: [
          {
            message: expect.stringMatching(/timeout/i),
          },
        ],
      },
      linkToWebsite: null,
      valid: false,
    }),
  );
});

test.concurrent('service url change is persisted and can be fetched via api', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken, project } = await createProject(ProjectType.Federation);

  // Create a token with write rights
  const writeToken = await createToken({
    targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    projectScopes: [ProjectAccessScope.Settings, ProjectAccessScope.Read],
    organizationScopes: [],
  });
  const dockerAddress = `${serviceName}:${servicePort}`;

  await enableExternalSchemaComposition(
    {
      endpoint: `http://${dockerAddress}/compose`,
      // eslint-disable-next-line no-process-env
      secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
      project: project.cleanId,
      organization: organization.cleanId,
    },
    writeToken.secret,
  ).then(r => r.expectNoGraphQLErrors());

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

  expect(compareResult.schemaCompareToPrevious).toMatchInlineSnapshot(`
    {
      changes: {
        nodes: [
          {
            criticality: Dangerous,
            message: [foo] New service url: 'https://api.com/products-new' (previously: 'https://api.com/products'),
          },
        ],
        total: 1,
      },
      initial: false,
    }
  `);
});

test.concurrent(
  'service url change is persisted and can be fetched via api (in combination with other change)',
  async () => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createToken, project } = await createProject(ProjectType.Federation);

    // Create a token with write rights
    const writeToken = await createToken({
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
      projectScopes: [ProjectAccessScope.Settings, ProjectAccessScope.Read],
      organizationScopes: [],
    });
    const dockerAddress = `${serviceName}:${servicePort}`;

    await enableExternalSchemaComposition(
      {
        endpoint: `http://${dockerAddress}/compose`,
        // eslint-disable-next-line no-process-env
        secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
        project: project.cleanId,
        organization: organization.cleanId,
      },
      writeToken.secret,
    ).then(r => r.expectNoGraphQLErrors());

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

    expect(compareResult.schemaCompareToPrevious).toMatchInlineSnapshot(`
      {
        changes: {
          nodes: [
            {
              criticality: Safe,
              message: Field 'name' was added to object type 'Product',
            },
            {
              criticality: Dangerous,
              message: [foo] New service url: 'https://api.com/products-new' (previously: 'https://api.com/products'),
            },
          ],
          total: 2,
        },
        initial: false,
      }
    `);
  },
);
