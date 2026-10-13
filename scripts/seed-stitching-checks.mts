/**
 * Creates a stitching project in an existing local organization, publishes three services to its
 * production target and runs a handful of checks across them, so the checks page has a stitched
 * target to look at. One check is for a service that was never published.
 *
 * `ORGANIZATION=<org slug> pnpm seed:stitching-checks`
 *
 * Prompts for the email of a local user who is a member of the organization (or set OWNER_EMAIL).
 * PROJECT picks the project slug (default `stitched-shop`). Needs docker compose and the server,
 * schema and app services running.
 */
// The testkit reaches @hive/api internals that use class decorators, so this must load first.
import 'reflect-metadata';
import { ProjectType, ResourceAssignmentModeType } from '../integration-tests/testkit/gql/graphql';

process.env.RUN_AGAINST_LOCAL_SERVICES = '1';
await import('../integration-tests/local-dev.ts');

const { createPostgresDatabasePool, psql } = await import('@hive/postgres');
const { getOrCreateAuth, getSeedPGConnectionString } = await import('./utils/get-or-create-auth');
const { promptForEmail } = await import('./utils/prompt-for-email');
const { checkSchema, createOrganizationAccessToken, createProject, publishSchema } = await import(
  '../integration-tests/testkit/flow'
);

const appUrl = process.env.HIVE_APP_BASE_URL ?? 'http://localhost:3000';
const organizationSlug = process.env.ORGANIZATION;
if (!organizationSlug) {
  throw new Error('Set ORGANIZATION to the slug of a local organization you are a member of.');
}
const projectSlug = process.env.PROJECT ?? 'stitched-shop';

// Plain SDL: stitching merges the services' types, so each one has to stand on its own.
const services = [
  {
    name: 'users',
    sdl: /* GraphQL */ `
      type Query {
        me: User
        user(id: ID!): User
      }

      type User {
        id: ID!
        name: String!
        email: String!
      }
    `,
  },
  {
    name: 'products',
    sdl: /* GraphQL */ `
      type Query {
        products: [Product!]!
        product(id: ID!): Product
      }

      type Product {
        id: ID!
        name: String!
        price: Int!
      }
    `,
  },
  {
    name: 'orders',
    sdl: /* GraphQL */ `
      type Query {
        orders: [Order!]!
      }

      type Order {
        id: ID!
        userId: ID!
        total: Int!
      }
    `,
  },
];

const checks = [
  {
    service: 'users',
    expect: 'passes, adds avatarUrl',
    sdl: services[0].sdl.replace('email: String!', 'email: String!\n        avatarUrl: String'),
  },
  {
    service: 'products',
    expect: 'fails, drops price',
    sdl: services[1].sdl.replace('price: Int!\n', ''),
  },
  {
    service: 'products',
    expect: 'passes, no changes',
    sdl: services[1].sdl,
  },
  {
    service: 'orders',
    expect: 'passes, adds status',
    sdl: services[2].sdl.replace('total: Int!', 'total: Int!\n        status: String'),
  },
  {
    // Never published, yet listed in the filter's options because it has a check.
    service: 'reviews',
    expect: 'passes, first check of a new service',
    sdl: /* GraphQL */ `
      type Query {
        reviews(productId: ID!): [Review!]!
      }

      type Review {
        id: ID!
        body: String!
        rating: Int!
      }
    `,
  },
  {
    service: 'users',
    expect: 'fails, references a type it does not define',
    sdl: /* GraphQL */ `
      type Query {
        me: User
        myOrders: [Order!]!
      }

      type User {
        id: ID!
        name: String!
        email: String!
      }
    `,
  },
];

const pool = await createPostgresDatabasePool({
  connectionParameters: getSeedPGConnectionString(),
});
// The token only exists for this run; it goes when the run does, whichever way it ends.
let seedTokenId: string | null = null;

try {
  const organization = (await pool.maybeOne(psql`
    SELECT "id", "clean_id" AS "slug" FROM "organizations" WHERE "clean_id" = ${organizationSlug}
  `)) as { id: string; slug: string } | null;
  if (!organization) {
    throw new Error(`No organization with slug ${organizationSlug}.`);
  }

  const email =
    process.env.OWNER_EMAIL ||
    (await promptForEmail('Email of a local user in this organization: '));
  const auth = await getOrCreateAuth(email);
  if (!auth.isExistingUser) {
    throw new Error(
      `${email} is a new user and cannot act in ${organization.slug}. Use a member's email.`,
    );
  }
  const ownerToken = auth.access_token;

  const projectResult = await createProject(
    { organization: { byId: organization.id }, slug: projectSlug, type: ProjectType.Stitching },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());
  const created = projectResult.createProject.ok;
  if (!created) {
    throw new Error(
      `Could not create project ${projectSlug} in ${organization.slug}; a project with that slug may exist. Set PROJECT to another slug.`,
    );
  }
  const project = created.createdProject;
  const target =
    created.createdTargets.find(target => target.slug === 'production') ??
    created.createdTargets[0];
  const pageUrl = `${appUrl}/${organization.slug}/${project.slug}/${target.slug}`;
  console.log(
    `\n  Created ${organization.slug}/${project.slug} (STITCHING), target ${target.slug}`,
  );

  const tokenResult = await createOrganizationAccessToken(
    {
      organization: { byId: organization.id },
      // Titles allow letters, digits, space, underscore and hyphen only.
      title: `seed stitching ${project.slug}`.slice(0, 100),
      description: 'Publishes and checks the seeded services. Safe to delete.',
      permissions: [
        'organization:describe',
        'project:describe',
        'schema:compose',
        'schemaCheck:create',
        'schemaVersion:publish',
      ],
      resources: {
        mode: ResourceAssignmentModeType.Granular,
        projects: [
          {
            projectId: project.id,
            targets: {
              mode: ResourceAssignmentModeType.Granular,
              targets: [
                {
                  targetId: target.id,
                  services: { mode: ResourceAssignmentModeType.All },
                  appDeployments: { mode: ResourceAssignmentModeType.All },
                },
              ],
            },
          },
        ],
      },
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());
  if (tokenResult.createOrganizationAccessToken.error) {
    throw new Error(tokenResult.createOrganizationAccessToken.error.message);
  }
  const registryToken = tokenResult.createOrganizationAccessToken.ok!.privateAccessKey;
  seedTokenId = tokenResult.createOrganizationAccessToken.ok!.createdOrganizationAccessToken.id;

  for (const [index, service] of services.entries()) {
    const result = await publishSchema(
      {
        author: 'User',
        commit: `publish-${index + 1}`,
        sdl: service.sdl,
        service: service.name,
        url: `https://${service.name}.stitched-shop.local/graphql`,
        target: { byId: target.id },
      },
      registryToken,
    ).then(r => r.expectNoGraphQLErrors());
    const publish = result.schemaPublish;
    if (publish.__typename !== 'SchemaPublishSuccess') {
      throw new Error(
        `Publish ${service.name} returned ${publish.__typename}: ${JSON.stringify(publish)}`,
      );
    }
    console.log(`  publish ${service.name}: ${publish.__typename}`);
  }

  console.log('');
  for (const [index, check] of checks.entries()) {
    const result = await checkSchema(
      {
        sdl: check.sdl,
        service: check.service,
        target: { byId: target.id },
        meta: { author: 'User', commit: `check-${index + 1}` },
      },
      registryToken,
    ).then(r => r.expectNoGraphQLErrors());
    const outcome = result.schemaCheck;
    const id = 'schemaCheck' in outcome ? outcome.schemaCheck?.id : null;
    console.log(
      `  check ${check.service.padEnd(9)} ${check.expect.padEnd(45)} ${outcome.__typename}${id ? '' : ' (not persisted)'}`,
    );
  }

  console.log(`
  Checks:    ${pageUrl}/checks
  Filtered:  ${pageUrl}/checks?filter_service=products
`);
} finally {
  if (seedTokenId) {
    await pool.query(psql`DELETE FROM "organization_access_tokens" WHERE "id" = ${seedTokenId}`);
  }
  await pool.end();
}
