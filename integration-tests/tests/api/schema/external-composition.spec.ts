import { TargetAccessScope, ProjectType, ProjectAccessScope } from '@app/gql/graphql';
import {
  createOrganization,
  publishSchema,
  createProject,
  createToken,
  enableExternalSchemaComposition,
} from '../../../testkit/flow';
import { history, dockerAddress } from '../../../testkit/external-composition';
import { authenticate } from '../../../testkit/auth';

test('call an external service to compose and validate services', async () => {
  const { access_token: owner_access_token } = await authenticate('main');
  const orgResult = await createOrganization(
    {
      name: 'foo',
    },
    owner_access_token
  );
  const org = orgResult.body.data!.createOrganization.ok!.createdOrganizationPayload.organization;

  const projectResult = await createProject(
    {
      organization: org.cleanId,
      type: ProjectType.Federation,
      name: 'bar',
    },
    owner_access_token
  );

  const project = projectResult.body.data!.createProject.ok!.createdProject;
  const target = projectResult.body.data!.createProject.ok!.createdTargets[0];

  // Create a token with write rights
  const writeTokenResult = await createToken(
    {
      name: 'test',
      organization: org.cleanId,
      project: project.cleanId,
      target: target.cleanId,
      organizationScopes: [],
      projectScopes: [ProjectAccessScope.Settings, ProjectAccessScope.Read],
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    owner_access_token
  );
  expect(writeTokenResult.body.errors).not.toBeDefined();
  const writeToken = writeTokenResult.body.data!.createToken.ok!.secret;

  const usersServiceName = Math.random().toString(16).substring(2);
  const publishUsersResult = await publishSchema(
    {
      author: 'Kamil',
      commit: 'init',
      url: 'https://api.com/users',
      sdl: `type Query { me: User } type User @key(fields: "id") { id: ID! name: String }`,
      service: usersServiceName,
    },
    writeToken
  );

  // Schema publish should be successful
  expect(publishUsersResult.body.errors).not.toBeDefined();
  expect(publishUsersResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // expect `users` service to be composed internally
  await expect(history()).resolves.not.toContainEqual(usersServiceName);

  // enable external composition
  const externalCompositionResult = await enableExternalSchemaComposition(
    {
      endpoint: `http://${dockerAddress}/compose`,
      secret: process.env.EXTERNAL_COMPOSITION_SECRET!,
      project: project.cleanId,
      organization: org.cleanId,
    },
    writeToken
  );
  expect(externalCompositionResult.body.errors).not.toBeDefined();
  expect(externalCompositionResult.body.data!.enableExternalSchemaComposition.ok?.endpoint).toBe(
    `http://${dockerAddress}/compose`
  );

  const productsServiceName = Math.random().toString(16).substring(2);
  const publishProductsResult = await publishSchema(
    {
      author: 'Kamil',
      commit: 'init',
      url: 'https://api.com/products',
      sdl: `type Query { products: [Product] } type Product @key(fields: "id") { id: ID! name: String }`,
      service: productsServiceName,
    },
    writeToken
  );

  // Schema publish should be successful
  expect(publishProductsResult.body.errors).not.toBeDefined();
  expect(publishProductsResult.body.data!.schemaPublish.__typename).toBe('SchemaPublishSuccess');

  // expect `products` service to be composed externally
  await expect(history()).resolves.toContainEqual(productsServiceName);
});
