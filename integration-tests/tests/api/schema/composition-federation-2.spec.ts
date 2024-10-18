import { ProjectAccessScope, ProjectType, TargetAccessScope } from 'testkit/gql/graphql';
import { enableExternalSchemaComposition } from '../../../testkit/flow';
import { initSeed } from '../../../testkit/seed';
import { generateUnique, getServiceHost } from '../../../testkit/utils';

// We do not resolve this to a host address, because we are calling this through a different flow:
// GraphQL API -> Schema service -> Composition service
const dockerAddress = await getServiceHost('composition_federation_2', 3069, false);

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
      url: 'https://api.com/users',
    })
    .then(r => r.expectNoGraphQLErrors());

  expect(publishUsersResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');

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
  // Disable Native Federation v2 composition to allow the external composition to take place
  await setNativeFederation(false);

  const productsServiceName = generateUnique();
  const publishProductsResult = await writeToken
    .publishSchema({
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
      url: 'https://api.com/products',
    })
    .then(r => r.expectNoGraphQLErrors());

  // Schema publish should be successful
  expect(publishProductsResult.schemaPublish.__typename).toBe('SchemaPublishSuccess');
});
