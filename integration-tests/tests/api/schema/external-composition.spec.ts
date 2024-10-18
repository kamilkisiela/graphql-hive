import { ProjectAccessScope, ProjectType, TargetAccessScope } from 'testkit/gql/graphql';
import { history } from '../../../testkit/external-composition';
import { enableExternalSchemaComposition } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';
import { generateUnique, getServiceHost } from '../../../testkit/utils';

test.concurrent('call an external service to compose and validate services', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken, project, setNativeFederation } = await createProject(ProjectType.Federation);

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
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

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

  expect(publishUsersResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // expect `users` service to be composed internally
  await expect(history()).resolves.not.toContainEqual(usersServiceName);

  // we use internal docker network to connect to the external composition service,
  // so we need to use the name and not resolved host
  const dockerAddress = await getServiceHost('external_composition', 3012, false);
  // enable external composition
  const externalCompositionResult = await enableExternalSchemaComposition(
    {
      endpoint: `http://${dockerAddress}/compose`,
      // eslint-disable-next-line no-process-env
      secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
      projectSlug: project.slug,
      organizationSlug: organization.slug,
    },
    writeToken.secret,
  ).then(r => r.expectNoGraphQLErrors());
  expect(
    externalCompositionResult.enableExternalSchemaComposition.ok?.externalSchemaComposition
      ?.endpoint,
  ).toBe(`http://${dockerAddress}/compose`);

  // set native federation to false to force external composition
  await setNativeFederation(false);

  const productsServiceName = generateUnique();
  const publishProductsResult = await writeToken
    .publishSchema({
      url: 'https://api.com/products',
      sdl: /* GraphQL */ `
        extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key"])

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

  // expect `products` service to be composed externally
  await expect(history()).resolves.toContainEqual(productsServiceName);

  // Schema publish should be successful
  expect(publishProductsResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
});

test.concurrent(
  'an expected error coming from the external composition service should be visible to the user',
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createToken, project, setNativeFederation } = await createProject(
      ProjectType.Federation,
    );

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
    const dockerAddress = await getServiceHost('external_composition', 3012, false);
    // enable external composition
    const externalCompositionResult = await enableExternalSchemaComposition(
      {
        endpoint: `http://${dockerAddress}/fail_on_signature`,
        // eslint-disable-next-line no-process-env
        secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
        projectSlug: project.slug,
        organizationSlug: organization.slug,
      },
      writeToken.secret,
    ).then(r => r.expectNoGraphQLErrors());
    expect(
      externalCompositionResult.enableExternalSchemaComposition.ok?.externalSchemaComposition
        ?.endpoint,
    ).toBe(`http://${dockerAddress}/fail_on_signature`);

    // set native federation to false to force external composition
    await setNativeFederation(false);

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
  async ({ expect }) => {
    const { createOrg } = await initSeed().createOwner();
    const { createProject, organization } = await createOrg();
    const { createToken, project, setNativeFederation } = await createProject(
      ProjectType.Federation,
    );

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
    const dockerAddress = await getServiceHost('external_composition', 3012, false);
    // enable external composition
    const externalCompositionResult = await enableExternalSchemaComposition(
      {
        endpoint: `http://${dockerAddress}/non-existing-endpoint`,
        // eslint-disable-next-line no-process-env
        secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
        projectSlug: project.slug,
        organizationSlug: organization.slug,
      },
      writeToken.secret,
    ).then(r => r.expectNoGraphQLErrors());
    expect(
      externalCompositionResult.enableExternalSchemaComposition.ok?.externalSchemaComposition
        ?.endpoint,
    ).toBe(`http://${dockerAddress}/non-existing-endpoint`);
    // set native federation to false to force external composition
    await setNativeFederation(false);

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

test.concurrent('a timeout error should be visible to the user', async ({ expect }) => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, organization } = await createOrg();
  const { createToken, project, setNativeFederation } = await createProject(ProjectType.Federation);

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
  const dockerAddress = await getServiceHost('external_composition', 3012, false);
  // enable external composition
  const externalCompositionResult = await enableExternalSchemaComposition(
    {
      endpoint: `http://${dockerAddress}/timeout`,
      // eslint-disable-next-line no-process-env
      secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
      projectSlug: project.slug,
      organizationSlug: organization.slug,
    },
    writeToken.secret,
  ).then(r => r.expectNoGraphQLErrors());
  expect(
    externalCompositionResult.enableExternalSchemaComposition.ok?.externalSchemaComposition
      ?.endpoint,
  ).toBe(`http://${dockerAddress}/timeout`);
  // set native federation to false to force external composition
  await setNativeFederation(false);

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
