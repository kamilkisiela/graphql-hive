import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildASTSchema, parse } from 'graphql';
import { createLogger } from 'graphql-yoga';
import { getServiceHost } from 'testkit/utils';
import { createHive } from '@graphql-hive/core';
import { appCheck, appCreate, appPublish, appRetire, cliErrorMessage } from '../../testkit/cli';
import { graphql } from '../../testkit/gql';
import { execute } from '../../testkit/graphql';
import { initSeed } from '../../testkit/seed';

const CLI_CreateAppDeployment = graphql(`
  mutation CLI_CreateAppDeployment($input: CreateAppDeploymentInput!) {
    createAppDeployment(input: $input) {
      error {
        message
      }
      ok {
        createdAppDeployment {
          id
          name
          version
          status
        }
      }
    }
  }
`);

const CLI_AddDocumentsToAppDeployment = graphql(`
  mutation CLI_AddDocumentsToAppDeployment($input: AddDocumentsToAppDeploymentInput!) {
    addDocumentsToAppDeployment(input: $input) {
      error {
        message
      }
      ok {
        appDeployment {
          id
          name
          version
          status
        }
      }
    }
  }
`);

const CLI_ActivateAppDeployment = graphql(`
  mutation CLI_ActivateAppDeployment($input: ActivateAppDeploymentInput!) {
    activateAppDeployment(input: $input) {
      error {
        message
      }
      ok {
        activatedAppDeployment {
          id
          name
          version
          status
        }
      }
    }
  }
`);

const CLI_GetAppDeploymentDocuments = graphql(`
  query CLI_GetAppDeploymentDocuments(
    $targetSelector: TargetSelectorInput!
    $appDeploymentName: String!
    $appDeploymentVersion: String!
  ) {
    target(reference: { bySelector: $targetSelector }) {
      appDeployment(appName: $appDeploymentName, appVersion: $appDeploymentVersion) {
        id
        status
        documents(first: 100) {
          edges {
            node {
              hash
              body
            }
          }
        }
      }
    }
  }
`);

const CLI_UpdateTargetAppDeploymentProtectionConfiguration = graphql(`
  mutation CLI_UpdateTargetAppDeploymentProtectionConfiguration(
    $input: UpdateTargetAppDeploymentProtectionConfigurationInput!
  ) {
    updateTargetAppDeploymentProtectionConfiguration(input: $input) {
      ok {
        target {
          id
        }
      }
      error {
        message
      }
    }
  }
`);

test('app:create --version is optional and auto-generates a version', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createTargetAccessToken } = await createProject();
  const token = await createTargetAccessToken({});

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        hello: String
      }
    `,
  });

  const operationsFile = join(tmpdir(), `operations-${Date.now()}.json`);
  await writeFile(operationsFile, JSON.stringify({ 'op-hash-1': 'query { hello }' }), 'utf-8');

  // no --version flag
  const output = await appCreate([
    '--registry.accessToken',
    token.secret,
    '--name',
    'auto-version-app',
    operationsFile,
  ]);

  expect(output).toContain('No version provided, using generated version:');
  expect(output).toContain('created');
});

test('app:check validates an Apollo manifest against the latest schema', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject } = await createOrg();
  const { createTargetAccessToken } = await createProject();
  const token = await createTargetAccessToken({});

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        hello: String
      }
    `,
  });

  const operationsFile = join(tmpdir(), `operations-${Date.now()}.json`);
  await writeFile(
    operationsFile,
    JSON.stringify({
      format: 'apollo-persisted-query-manifest',
      version: 1,
      operations: [{ id: 'op-hash-1', body: 'query { hello }' }],
    }),
    'utf-8',
  );

  const output = await appCheck(['--registry.accessToken', token.secret, operationsFile]);

  expect(output).toContain('All operations are valid (1)');

  await writeFile(
    operationsFile,
    JSON.stringify({
      format: 'apollo-persisted-query-manifest',
      version: 1,
      operations: [{ id: 'op-hash-1', body: 'query { goodbye }' }],
    }),
    'utf-8',
  );

  await expect(appCheck(['--registry.accessToken', token.secret, operationsFile])).rejects.toThrow(
    /Cannot query field .*goodbye.* on type .*Query.*\./,
  );

  await writeFile(
    operationsFile,
    JSON.stringify({
      format: 'apollo-persisted-query-manifest',
      version: 1,
      operations: [
        {
          id: 'multi-operation-hash',
          body: 'query First { hello } query Second { hello }',
        },
      ],
    }),
    'utf-8',
  );

  await expect(appCheck(['--registry.accessToken', token.secret, operationsFile])).rejects.toThrow(
    /Multiple operation definitions found\./,
  );
});

test('app:check handles missing and empty operation inputs', async () => {
  const accessToken = 'unused-access-token';
  const missingOperationsFile = join(tmpdir(), `missing-operations-${Date.now()}.json`);

  const missingMessage = await cliErrorMessage(
    appCheck(['--registry.accessToken', accessToken, missingOperationsFile]),
  );
  expect(missingMessage).toContain('The file does not exist.');
  expect(missingMessage).toContain('[118]');

  const emptyOperationsFile = join(tmpdir(), `empty-operations-${Date.now()}.json`);
  await writeFile(emptyOperationsFile, '{}', 'utf-8');

  await expect(
    appCheck(['--registry.accessToken', accessToken, emptyOperationsFile]),
  ).resolves.toContain('No operations found');
});

test('app:create --publish creates and immediately activates the deployment', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag, organization } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createTargetAccessToken, project, target } = await createProject();
  const token = await createTargetAccessToken({});

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        hello: String
      }
    `,
  });

  const operationsFile = join(tmpdir(), `operations-${Date.now()}.json`);
  await writeFile(operationsFile, JSON.stringify({ 'op-hash-1': 'query { hello }' }), 'utf-8');

  const output = await appCreate([
    '--registry.accessToken',
    token.secret,
    '--name',
    'publish-flag-app',
    '--version',
    '1.0.0',
    '--publish',
    operationsFile,
  ]);

  expect(output).toContain('App deployment published successfully.');

  // verify the deployment is active via the API
  const result = await execute({
    document: CLI_GetAppDeploymentDocuments,
    variables: {
      targetSelector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      appDeploymentName: 'publish-flag-app',
      appDeploymentVersion: '1.0.0',
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(result.target?.appDeployment?.status).toBe('active');
});

test('app:create accepts a JSON file as operations input', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag, organization } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createTargetAccessToken, project, target } = await createProject();
  const token = await createTargetAccessToken({});

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        hello: String
      }
    `,
  });

  const manifest = { 'op-hash-1': 'query { hello }' };
  const operationsFile = join(tmpdir(), `operations-${Date.now()}.json`);
  await writeFile(operationsFile, JSON.stringify(manifest), 'utf-8');

  await appCreate([
    '--registry.accessToken',
    token.secret,
    '--name',
    'file-input-app',
    '--version',
    '1.0.0',
    operationsFile,
  ]);

  await appPublish([
    '--registry.accessToken',
    token.secret,
    '--name',
    'file-input-app',
    '--version',
    '1.0.0',
  ]);

  const result = await execute({
    document: CLI_GetAppDeploymentDocuments,
    variables: {
      targetSelector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      appDeploymentName: 'file-input-app',
      appDeploymentVersion: '1.0.0',
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(result.target?.appDeployment?.status).toBe('active');
  expect(result.target?.appDeployment?.documents?.edges).toHaveLength(1);
  expect(result.target?.appDeployment?.documents?.edges[0].node).toMatchObject({
    hash: 'op-hash-1',
    body: 'query { hello }',
  });
});

test('app:create accepts an Apollo persisted query manifest', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag, organization } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createTargetAccessToken, project, target } = await createProject();
  const token = await createTargetAccessToken({});

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        hello: String
        goodbye: String
      }
    `,
  });

  const manifest = {
    format: 'apollo-persisted-query-manifest',
    version: 1,
    operations: [
      {
        id: 'sha256:apollo-operation-1',
        body: 'query GetHello { hello }',
        name: 'GetHello',
        type: 'query',
      },
      {
        id: 'apollo-operation-2',
        body: 'query GetGoodbye { goodbye }',
        name: 'GetGoodbye',
        type: 'query',
      },
    ],
  };
  const operationsFile = join(tmpdir(), `apollo-operations-${Date.now()}.json`);
  await writeFile(operationsFile, JSON.stringify(manifest), 'utf-8');

  await appCreate([
    '--registry.accessToken',
    token.secret,
    '--name',
    'apollo-manifest-app',
    '--version',
    '1.0.0',
    operationsFile,
  ]);

  await appPublish([
    '--registry.accessToken',
    token.secret,
    '--name',
    'apollo-manifest-app',
    '--version',
    '1.0.0',
  ]);

  const result = await execute({
    document: CLI_GetAppDeploymentDocuments,
    variables: {
      targetSelector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      appDeploymentName: 'apollo-manifest-app',
      appDeploymentVersion: '1.0.0',
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(result.target?.appDeployment?.status).toBe('active');
  expect(result.target?.appDeployment?.documents?.edges).toHaveLength(2);
  expect(result.target?.appDeployment?.documents?.edges.map(edge => edge.node)).toEqual(
    expect.arrayContaining([
      {
        hash: 'sha256:apollo-operation-1',
        body: 'query GetHello { hello }',
      },
      {
        hash: 'apollo-operation-2',
        body: 'query GetGoodbye { goodbye }',
      },
    ]),
  );
});

test('app:create accepts a directory of .graphql files as operations input', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag, organization } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createTargetAccessToken, project, target } = await createProject();
  const token = await createTargetAccessToken({});

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        hello: String
      }
    `,
  });

  const opsDir = join(tmpdir(), `ops-dir-${Date.now()}`);
  await mkdir(opsDir, { recursive: true });
  const operationBody = 'query GetHello { hello }';
  await writeFile(join(opsDir, 'GetHello.graphql'), operationBody, 'utf-8');

  const normalizedBody = operationBody.replace('\n', ' ').replace(/\s+/g, ' ').trim();
  const expectedHash = createHash('sha256').update(normalizedBody).digest('hex');

  const output = await appCreate([
    '--registry.accessToken',
    token.secret,
    '--name',
    'dir-input-app',
    '--version',
    '1.0.0',
    opsDir,
  ]);

  expect(output).toContain('Persisted documents manifest generated in-memory');

  await appPublish([
    '--registry.accessToken',
    token.secret,
    '--name',
    'dir-input-app',
    '--version',
    '1.0.0',
  ]);

  const result = await execute({
    document: CLI_GetAppDeploymentDocuments,
    variables: {
      targetSelector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      appDeploymentName: 'dir-input-app',
      appDeploymentVersion: '1.0.0',
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(result.target?.appDeployment?.status).toBe('active');
  expect(result.target?.appDeployment?.documents?.edges).toHaveLength(1);
  expect(result.target?.appDeployment?.documents?.edges[0].node).toMatchObject({
    hash: expectedHash,
    body: normalizedBody,
  });
});

test('app:create accepts a glob pattern of .graphql files as operations input', async () => {
  const { createOrg } = await initSeed().createOwner();
  const { createProject, setFeatureFlag, organization } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createTargetAccessToken, project, target } = await createProject();
  const token = await createTargetAccessToken({});

  await token.publishSchema({
    sdl: /* GraphQL */ `
      type Query {
        hello: String
        world: String
      }
    `,
  });

  const opsDir = join(tmpdir(), `ops-glob-${Date.now()}`);
  const subDir = join(opsDir, 'sub');
  await mkdir(subDir, { recursive: true });

  const op1 = 'query GetHello { hello }';
  const op2 = 'query GetWorld { world }';
  await writeFile(join(opsDir, 'GetHello.graphql'), op1, 'utf-8');
  await writeFile(join(subDir, 'GetWorld.graphql'), op2, 'utf-8');

  const normalize = (op: string) => op.replace('\n', ' ').replace(/\s+/g, ' ').trim();
  const hash1 = createHash('sha256').update(normalize(op1)).digest('hex');
  const hash2 = createHash('sha256').update(normalize(op2)).digest('hex');

  // must be quoted to prevent shell expansion
  const globPattern = `"${opsDir}/**/*.graphql"`;

  const output = await appCreate([
    '--registry.accessToken',
    token.secret,
    '--name',
    'glob-input-app',
    '--version',
    '1.0.0',
    globPattern,
  ]);

  expect(output).toContain('Persisted documents manifest generated in-memory');

  await appPublish([
    '--registry.accessToken',
    token.secret,
    '--name',
    'glob-input-app',
    '--version',
    '1.0.0',
  ]);

  const result = await execute({
    document: CLI_GetAppDeploymentDocuments,
    variables: {
      targetSelector: {
        organizationSlug: organization.slug,
        projectSlug: project.slug,
        targetSlug: target.slug,
      },
      appDeploymentName: 'glob-input-app',
      appDeploymentVersion: '1.0.0',
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  expect(result.target?.appDeployment?.status).toBe('active');

  const edges = result.target?.appDeployment?.documents?.edges ?? [];
  expect(edges).toHaveLength(2);

  const hashes = edges.map(e => e.node.hash);
  expect(hashes).toContain(hash1);
  expect(hashes).toContain(hash2);
});

test('app:retire --force bypasses protection', async () => {
  const { createOrg, ownerToken } = await initSeed().createOwner();
  const { createProject, setFeatureFlag, organization } = await createOrg();
  await setFeatureFlag('appDeployments', true);
  const { createTargetAccessToken, project, target, waitForOperationsCollected } =
    await createProject();
  const token = await createTargetAccessToken({});

  const sdl = /* GraphQL */ `
    type Query {
      hello: String
    }
  `;

  await token.publishSchema({ sdl });

  // Enable protection with strict settings
  await execute({
    document: CLI_UpdateTargetAppDeploymentProtectionConfiguration,
    variables: {
      input: {
        target: {
          bySelector: {
            organizationSlug: organization.slug,
            projectSlug: project.slug,
            targetSlug: target.slug,
          },
        },
        appDeploymentProtectionConfiguration: {
          isEnabled: true,
          minDaysInactive: 365, // Very strict - 1 year
          maxTrafficPercentage: 0, // No traffic allowed
        },
      },
    },
    authToken: ownerToken,
  }).then(res => res.expectNoGraphQLErrors());

  // Create and activate app deployment
  await execute({
    document: CLI_CreateAppDeployment,
    variables: {
      input: {
        appName: 'cli-force-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  await execute({
    document: CLI_AddDocumentsToAppDeployment,
    variables: {
      input: {
        appName: 'cli-force-app',
        appVersion: '1.0.0',
        documents: [
          {
            hash: 'hash',
            body: 'query { hello }',
          },
        ],
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  await execute({
    document: CLI_ActivateAppDeployment,
    variables: {
      input: {
        appName: 'cli-force-app',
        appVersion: '1.0.0',
      },
    },
    authToken: token.secret,
  }).then(res => res.expectNoGraphQLErrors());

  // Report usage to trigger protection
  const usageAddress = await getServiceHost('usage', 8081);

  const client = createHive({
    enabled: true,
    token: token.secret,
    usage: true,
    debug: false,
    agent: {
      logger: createLogger('debug'),
      maxSize: 1,
    },
    selfHosting: {
      usageEndpoint: 'http://' + usageAddress,
      graphqlEndpoint: 'http://noop/',
      applicationUrl: 'http://noop/',
    },
  });

  const request = new Request('http://localhost:4000/graphql', {
    method: 'POST',
    headers: {
      'x-graphql-client-name': 'cli-force-app',
      'x-graphql-client-version': '1.0.0',
    },
  });

  await client.collectUsage().finish(
    {
      document: parse(`query { hello }`),
      schema: buildASTSchema(parse(sdl)),
      contextValue: { request },
    },
    {},
    'cli-force-app~1.0.0~hash',
  );

  await waitForOperationsCollected(1);

  const targetSlug = `${organization.slug}/${project.slug}/${target.slug}`;

  // CLI retire without --force should fail
  await expect(
    appRetire([
      '--registry.accessToken',
      token.secret,
      '--name',
      'cli-force-app',
      '--version',
      '1.0.0',
      '--target',
      targetSlug,
    ]),
  ).rejects.toThrow();

  // CLI retire with --force should succeed
  const result = await appRetire([
    '--registry.accessToken',
    token.secret,
    '--name',
    'cli-force-app',
    '--version',
    '1.0.0',
    '--target',
    targetSlug,
    '--force',
  ]);

  expect(result).toContain('retired successfully');
});
