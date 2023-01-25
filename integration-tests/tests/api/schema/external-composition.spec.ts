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
  expect(externalCompositionResult.enableExternalSchemaComposition.ok?.endpoint).toBe(
    `http://${dockerAddress}/compose`,
  );

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
  'the error coming from the external composition service should be visible to the user',
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
        endpoint: `http://${dockerAddress}/compose_and_fail_on_signature`,
        // eslint-disable-next-line no-process-env
        secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
        project: project.cleanId,
        organization: organization.cleanId,
      },
      writeToken.secret,
    ).then(r => r.expectNoGraphQLErrors());
    expect(externalCompositionResult.enableExternalSchemaComposition.ok?.endpoint).toBe(
      `http://${dockerAddress}/compose`,
    );

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
        errors: {
          total: 1,
          nodes: [
            {
              message: 'External composition failure: ERR_INVALID_SIGNATURE',
            },
          ],
        },
      }),
    );
  },
);
