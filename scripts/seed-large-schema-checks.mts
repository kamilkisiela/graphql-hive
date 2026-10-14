/**
 * Creates a federation project with a ~200k-line schema and two checks against it, so the checks
 * page's Public Schema and Supergraph diffs can be tried at the size that froze the page.
 *
 * - Check A (`alpha`, new service): redefines 500 of `zeta`'s types and adds 5 new ones.
 *   Composition emits types in subgraph-name order, so the 500 jump to the top of the composed
 *   schema: a huge raw line diff for 5 real changes.
 * - Check B (`zeta`): rewrites every type's description, a genuinely large change.
 * - Then publishes `alpha`, so the history page gets a version whose diff is the same reordering.
 *
 * `ORGANIZATION=<org slug> pnpm seed:large-schema-checks`
 *
 * Prompts for the email of a local user who is a member of the organization (or set OWNER_EMAIL).
 * PROJECT picks the project slug (default `large-schema`), TYPES the number of types (default
 * 5000, about 210k lines). Needs docker compose and the server, schema and app services running.
 *
 * Every type and field has a description, so the line count is high for the number of schema
 * elements and 5000 types compose within the composition worker's default 512MB heap. Much larger
 * TYPES values need COMPOSITION_WORKER_MAX_OLD_GENERATION_SIZE_MB raised in the schema service.
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
const projectSlug = process.env.PROJECT ?? 'large-schema';
const typeCount = Number(process.env.TYPES ?? 5_000);
const movedCount = 500;
if (!Number.isInteger(typeCount) || typeCount <= movedCount) {
  throw new Error(`TYPES must be an integer above ${movedCount}.`);
}

const link =
  'extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@shareable"])\n';

const fields = [
  'id: ID!',
  'timestamp: String',
  'value1: Int',
  'value2: Boolean',
  'value3: Float',
  'value4: [String]',
  'value5: String',
  'value6: Int',
  'value7: Boolean',
];

// Both subgraphs define the moved types, so they have to be shareable to compose.
function stressType(id: number, revised = false) {
  const description = revised
    ? `Stress type ${id}, used to test large schemas (revised).`
    : `Stress type ${id}, used to test large schemas.`;
  return `"""
${description}
"""
type StressType_${id} @shareable {
${fields.map((field, index) => `  """\n  Field ${index} of stress type ${id}.\n  """\n  ${field}\n`).join('')}}
`;
}

const ids = Array.from({ length: typeCount }, (_, index) => index + 1);
const newTypeIds = [1, 2, 3, 4, 5];

const zetaSdl =
  link + 'type Query {\n  health: String\n}\n' + ids.map(id => stressType(id)).join('');
const zetaRevisedSdl =
  link + 'type Query {\n  health: String\n}\n' + ids.map(id => stressType(id, true)).join('');
const alphaSdl =
  link +
  `type Query {\n${newTypeIds.map(id => `  newThing${id}: NewThing${id}\n`).join('')}}\n` +
  newTypeIds.map(id => `type NewThing${id} {\n  id: ID!\n  name: String\n}\n`).join('') +
  ids
    .slice(-movedCount)
    .map(id => stressType(id))
    .join('');

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
    { organization: { byId: organization.id }, slug: projectSlug, type: ProjectType.Federation },
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
    `\n  Created ${organization.slug}/${project.slug} (FEDERATION), target ${target.slug}, ${typeCount} types`,
  );

  const tokenResult = await createOrganizationAccessToken(
    {
      organization: { byId: organization.id },
      // Titles allow letters, digits, space, underscore and hyphen only.
      title: `seed large schema ${project.slug}`.slice(0, 100),
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

  async function publish(service: string, sdl: string, commit: string) {
    const result = await publishSchema(
      {
        author: 'User',
        commit,
        sdl,
        service,
        url: `https://${service}.large-schema.local/graphql`,
        target: { byId: target.id },
      },
      registryToken,
    ).then(r => r.expectNoGraphQLErrors());
    const outcome = result.schemaPublish;
    if (outcome.__typename !== 'SchemaPublishSuccess') {
      throw new Error(
        `Publish ${service} returned ${outcome.__typename}: ${JSON.stringify(outcome)}`,
      );
    }
    console.log(`  publish ${service}: ${outcome.__typename}`);
    return outcome.linkToWebsite;
  }

  async function check(service: string, sdl: string, commit: string, expect: string) {
    const result = await checkSchema(
      {
        sdl,
        service,
        url: `https://${service}.large-schema.local/graphql`,
        target: { byId: target.id },
        meta: { author: 'User', commit },
      },
      registryToken,
    ).then(r => r.expectNoGraphQLErrors());
    const outcome = result.schemaCheck;
    const id = 'schemaCheck' in outcome ? outcome.schemaCheck?.id : null;
    console.log(`  check ${service.padEnd(6)} ${expect.padEnd(40)} ${outcome.__typename}`);
    if (!id) {
      throw new Error(`Check ${service} was not persisted: ${JSON.stringify(outcome)}`);
    }
    return `${pageUrl}/checks/${id}`;
  }

  await publish('zeta', zetaSdl, 'publish-zeta');
  console.log('');
  const reorderCheckUrl = await check(
    'alpha',
    alphaSdl,
    'check-reorder',
    `reorders ${movedCount} types, adds 5`,
  );
  const largeCheckUrl = await check(
    'zeta',
    zetaRevisedSdl,
    'check-large',
    `rewrites ${typeCount} descriptions`,
  );
  console.log('');
  const versionUrl = await publish('alpha', alphaSdl, 'publish-alpha');

  console.log(`
  Check A (reordered):    ${reorderCheckUrl}
  Check B (large change): ${largeCheckUrl}
  History (reordered):    ${versionUrl ?? `${pageUrl}/history`}
`);
} finally {
  if (seedTokenId) {
    await pool.query(psql`DELETE FROM "organization_access_tokens" WHERE "id" = ${seedTokenId}`);
  }
  await pool.end();
}
