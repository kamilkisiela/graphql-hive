import { TargetAccessScope, ProjectType } from '@app/gql/graphql';
import { initSeed } from '../../../testkit/seed';

test.concurrent('can check a schema with target:registry:read access', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);

  // Create a token with write rights
  const writeToken = await createToken([
    TargetAccessScope.RegistryRead,
    TargetAccessScope.RegistryWrite,
  ]);

  // Publish schema with write rights
  const publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          ping: String
        }
      `,
    })
    .then(r => r.expectNoGraphQLErrors());
  // Schema publish should be successful
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // Create a token with no rights
  const noAccessToken = await createToken([], [], []);

  // Create a token with read rights
  const readToken = await createToken([TargetAccessScope.RegistryRead], [], []);

  // Check schema with no read and write rights
  const checkResultErrors = await noAccessToken
    .checkSchema(
      /* GraphQL */ `
        type Query {
          ping: String
          foo: String
        }
      `,
    )
    .then(r => r.expectGraphQLErrors());
  expect(checkResultErrors).toHaveLength(1);
  expect(checkResultErrors[0].message).toMatch('target:registry:read');

  // Check schema with read rights
  const checkResultValid = await readToken
    .checkSchema(
      /* GraphQL */ `
        type Query {
          ping: String
          foo: String
        }
      `,
    )
    .then(r => r.expectNoGraphQLErrors());
  expect(checkResultValid.schemaCheck.__typename).toBe('SchemaCheckSuccess');
});

test.concurrent('should match indentation of previous description', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createToken } = await createProject(ProjectType.Single);

  // Create a token with write rights
  const writeToken = await createToken(
    [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    [],
    [],
  );

  // Publish schema with write rights
  const publishResult = await writeToken
    .publishSchema({
      sdl: /* GraphQL */ `
        type Query {
          " ping-ping  "
          ping: String
          "pong-pong"
          pong: String
        }
      `,
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be successful
  expect(publishResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // Create a token with read rights
  const readToken = await createToken([TargetAccessScope.RegistryRead], [], []);

  // Check schema with read rights
  const checkResult = await readToken
    .checkSchema(
      /* GraphQL */ `
        type Query {
          """
          ping-ping
          """
          ping: String
          " pong-pong "
          pong: String
        }
      `,
    )
    .then(r => r.expectNoGraphQLErrors());
  const check = checkResult.schemaCheck;

  if (check.__typename !== 'SchemaCheckSuccess') {
    throw new Error(`Expected SchemaCheckSuccess, got ${check.__typename}`);
  }

  expect(check.__typename).toBe('SchemaCheckSuccess');
  expect(check.changes!.total).toBe(0);
});
