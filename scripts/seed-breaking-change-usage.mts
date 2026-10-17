/**
 * Seeds a check whose breaking changes were used across several targets, in a new org for your
 * email. `CONTRACTS=1` makes it a federation project whose check also fails one contract.
 *
 * Needs docker compose and the server, usage, usage-ingestor and app services. `OWNER_EMAIL=<email>`
 * skips the prompt; piping an answer into it does not work.
 */
import 'reflect-metadata';
import { ProjectType, TargetAccessScope } from '../integration-tests/testkit/gql/graphql';
import type { CollectedOperation } from '../integration-tests/testkit/usage';

process.env.RUN_AGAINST_LOCAL_SERVICES = '1';
await import('../integration-tests/local-dev.ts');

const { getOrCreateAuth } = await import('./utils/get-or-create-auth');
const { promptForEmail } = await import('./utils/prompt-for-email');
const {
  checkSchema,
  createContract,
  createOrganization,
  createProject,
  createTarget,
  createToken,
  publishSchema,
  readOperationsStats,
  updateTargetValidationSettings,
} = await import('../integration-tests/testkit/flow');
const { legacyCollect } = await import('../integration-tests/testkit/usage');
const { generateUnique } = await import('../integration-tests/testkit/utils');

const APP_BASE_URL = 'http://localhost:3000';
const WITH_CONTRACTS = process.env.CONTRACTS === '1';
const SERVICE = { name: 'funnel', url: 'http://funnel.local/graphql' };

const FEDERATION_LINKS = /* GraphQL */ `
  extend schema
    @link(url: "https://specs.apollo.dev/link/v1.0")
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@tag"])
`;
const EXTRA_TARGETS = ['app-web', 'app-ios', 'app-android', 'partner-api', 'internal', 'canary'];

const SDL = /* GraphQL */ `
  type Query {
    funnelClosedWon: FunnelMetricsClosedWon
    funnelCreated: FunnelMetricsCreated
    prospectsContacted: ProspectsContacted
    prospectsContactedActivity: ProspectsContactedActivity
    health: String
  }

  type FunnelMetricsClosedWon {
    count: Int
  }

  type FunnelMetricsCreated {
    count: Int
  }

  type ProspectsContacted {
    count: Int
  }

  type ProspectsContactedActivity {
    count: Int
  }
`;

const CHECK_SDL = /* GraphQL */ `
  type Query {
    health: String
  }
`;

const FEDERATION_SDL =
  FEDERATION_LINKS +
  SDL.replace(
    /^(\s+(?:funnelClosedWon|funnelCreated|prospectsContacted|prospectsContactedActivity): \w+)$/gm,
    '$1 @tag(name: "internal")',
  );

// Tagging the one field left on Query fails `public-api`, which excludes `internal`.
const FEDERATION_CHECK_SDL =
  FEDERATION_LINKS +
  /* GraphQL */ `
    type Query {
      health: String @tag(name: "internal")
    }
  `;

const OPERATIONS = {
  closedWon: {
    operation: 'query FunnelMetricsClosedWon { funnelClosedWon { count } }',
    operationName: 'FunnelMetricsClosedWon',
    fields: [
      'Query',
      'Query.funnelClosedWon',
      'FunnelMetricsClosedWon',
      'FunnelMetricsClosedWon.count',
    ],
  },
  closedWonSummary: {
    operation: 'query FunnelMetricsClosedWonSummary { funnelClosedWon { count } health }',
    operationName: 'FunnelMetricsClosedWonSummary',
    fields: [
      'Query',
      'Query.funnelClosedWon',
      'Query.health',
      'FunnelMetricsClosedWon',
      'FunnelMetricsClosedWon.count',
    ],
  },
  created: {
    operation: 'query FunnelMetricsCreated { funnelCreated { count } }',
    operationName: 'FunnelMetricsCreated',
    fields: ['Query', 'Query.funnelCreated', 'FunnelMetricsCreated', 'FunnelMetricsCreated.count'],
  },
  prospects: {
    operation: 'query ProspectsContacted { prospectsContacted { count } }',
    operationName: 'ProspectsContacted',
    fields: ['Query', 'Query.prospectsContacted', 'ProspectsContacted', 'ProspectsContacted.count'],
  },
} as const;

// ProspectsContactedActivity is never reported, so its removal is safe based on usage.
const USAGE: Record<string, Array<{ op: keyof typeof OPERATIONS; times: number }>> = {
  production: [
    { op: 'closedWon', times: 2 },
    { op: 'closedWonSummary', times: 1 },
    { op: 'prospects', times: 1 },
  ],
  'app-web': [{ op: 'closedWon', times: 1 }],
  staging: [{ op: 'created', times: 2 }],
  'app-ios': [{ op: 'created', times: 1 }],
};

function collected(op: keyof typeof OPERATIONS): CollectedOperation {
  return {
    timestamp: Date.now(),
    ...OPERATIONS[op],
    fields: [...OPERATIONS[op].fields],
    execution: { ok: true, duration: 150_000_000, errorsTotal: 0 },
    metadata: { client: { name: 'webapp', version: '1.0.0' } },
  };
}

const ownerEmail = process.env.OWNER_EMAIL || (await promptForEmail());
if (!ownerEmail) {
  console.error('An owner email is required, so the org lands where you are signed in.');
  process.exit(1);
}
const { access_token: ownerToken } = await getOrCreateAuth(ownerEmail);

console.log('\nCreating org, project and targets...');
const organization = await createOrganization({ slug: generateUnique() }, ownerToken)
  .then(r => r.expectNoGraphQLErrors())
  .then(r => r.createOrganization.ok!.createdOrganizationPayload.organization);
const projectResult = await createProject(
  {
    organization: { bySelector: { organizationSlug: organization.slug } },
    type: WITH_CONTRACTS ? ProjectType.Federation : ProjectType.Single,
    slug: WITH_CONTRACTS ? 'breaking-usage-contracts' : 'breaking-usage',
  },
  ownerToken,
).then(r => r.expectNoGraphQLErrors());
const project = projectResult.createProject.ok!.createdProject;
const targets = [...projectResult.createProject.ok!.createdTargets];

for (const slug of EXTRA_TARGETS) {
  const created = await createTarget(
    {
      slug,
      project: {
        bySelector: { organizationSlug: organization.slug, projectSlug: project.slug },
      },
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());
  targets.push(created.createTarget.ok!.createdTarget as (typeof targets)[number]);
}

const secrets = new Map<string, string>();
for (const target of targets) {
  const result = await createToken(
    {
      name: generateUnique(),
      organizationSlug: organization.slug,
      projectSlug: project.slug,
      targetSlug: target.slug,
      organizationScopes: [],
      projectScopes: [],
      targetScopes: [TargetAccessScope.RegistryRead, TargetAccessScope.RegistryWrite],
    },
    ownerToken,
  ).then(r => r.expectNoGraphQLErrors());
  secrets.set(target.slug, result.createToken.ok!.secret);
}

const production = targets.find(target => target.slug === 'production');
if (!production) {
  console.error('The new project has no production target.');
  process.exit(1);
}
const productionSecret = secrets.get('production')!;

console.log('Publishing the schema to production...');
const published = await publishSchema(
  WITH_CONTRACTS
    ? {
        author: 'seed-breaking-change-usage',
        commit: 'seed',
        sdl: FEDERATION_SDL,
        service: SERVICE.name,
        url: SERVICE.url,
      }
    : { author: 'seed-breaking-change-usage', commit: 'seed', sdl: SDL },
  productionSecret,
  'authorization',
);
const publishResult = published.rawBody.data?.schemaPublish;
if (published.rawBody.errors?.length || publishResult?.__typename !== 'SchemaPublishSuccess') {
  console.error('Schema publish failed:', published.rawBody.errors ?? publishResult);
  process.exit(1);
}

console.log('Reporting usage...');
for (const [slug, entries] of Object.entries(USAGE)) {
  const operations = entries.flatMap(entry =>
    Array.from({ length: entry.times }, () => collected(entry.op)),
  );
  const result = await legacyCollect({
    operations,
    token: secrets.get(slug)!,
    authorizationHeader: 'authorization',
  });
  if (result.status !== 200) {
    console.error(`Usage for ${slug} was rejected (status ${result.status}):`, result.body);
    process.exit(1);
  }
  console.log(`  ${slug}: ${operations.length} operations`);
}

console.log('Waiting for ingestion...');
// `totalOperations` counts distinct operations, not requests.
const expected = Object.fromEntries(
  Object.entries(USAGE).map(([slug, entries]) => [slug, entries.length]),
);
const period = {
  from: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  to: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};
const deadline = Date.now() + 120_000;
let pending = Object.keys(expected);
while (pending.length && Date.now() < deadline) {
  await new Promise(resolve => setTimeout(resolve, 3_000));
  const totals = await Promise.all(
    pending.map(slug =>
      readOperationsStats(
        {
          bySelector: {
            organizationSlug: organization.slug,
            projectSlug: project.slug,
            targetSlug: slug,
          },
        },
        period,
        {},
        ownerToken,
      )
        .then(r => r.expectNoGraphQLErrors())
        .then(r => r.target?.operationsStats.totalOperations ?? 0),
    ),
  );
  pending = pending.filter((slug, index) => totals[index] < expected[slug]);
}
if (pending.length) {
  console.error(`Usage did not arrive for ${pending.join(', ')} within two minutes.`);
  process.exit(1);
}

console.log('Turning on conditional breaking changes across all targets...');
await updateTargetValidationSettings(
  {
    target: {
      bySelector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: production.slug,
      },
    },
    conditionalBreakingChangeConfiguration: {
      isEnabled: true,
      percentage: 0,
      period: 7,
      targetIds: targets.map(target => target.id),
    },
  },
  { authToken: ownerToken },
).then(r => r.expectNoGraphQLErrors());

if (WITH_CONTRACTS) {
  console.log('Adding contracts...');
  for (const contract of [
    { contractName: 'public-api', excludeTags: ['internal'] },
    { contractName: 'partner-api', excludeTags: ['partner'] },
  ]) {
    const created = await createContract(
      {
        target: { byId: production.id },
        removeUnreachableTypesFromPublicApiSchema: true,
        ...contract,
      },
      ownerToken,
    ).then(r => r.expectNoGraphQLErrors());
    if (created.createContract.error) {
      console.error(`Contract ${contract.contractName} failed:`, created.createContract.error);
      process.exit(1);
    }
  }
}

console.log('Running the check...');
const check = await checkSchema(
  WITH_CONTRACTS ? { sdl: FEDERATION_CHECK_SDL, service: SERVICE.name } : { sdl: CHECK_SDL },
  productionSecret,
).then(r => r.expectNoGraphQLErrors());
const result = check.schemaCheck as { __typename: string; schemaCheck?: { id: string } | null };
if (!result.schemaCheck?.id) {
  console.error('The check did not return an id:', result);
  process.exit(1);
}

console.log(`\nDone (${result.__typename}). Open the check:`);
console.log(
  `  ${APP_BASE_URL}/${organization.slug}/${project.slug}/${production.slug}/checks/${result.schemaCheck.id}`,
);
process.exit(0);
