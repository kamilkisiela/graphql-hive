import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execa } from '@esm2cjs/execa';

const binPath = resolve(__dirname, '../../../packages/libraries/cli/bin/run');

type GraphQLRequest = {
  query: string;
  operationName: string;
  variables: Record<string, any>;
};

const githubEnv = {
  GITHUB_ACTIONS: '1',
  GITHUB_REPOSITORY: 'foo/foo',
  GITHUB_EVENT_PATH: '',
};

async function runAgainstRegistry(
  respond: (request: GraphQLRequest) => object,
  args: string[],
  env: Record<string, string> = {},
) {
  const requests: GraphQLRequest[] = [];
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', chunk => (body += chunk));
    request.on('end', () => {
      const parsed = JSON.parse(body);
      const graphQLRequest: GraphQLRequest = {
        ...parsed,
        operationName: /(?:mutation|query)\s+(\w+)/.exec(parsed.query)?.[1] ?? '',
      };
      requests.push(graphQLRequest);
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(respond(graphQLRequest)));
    });
  });
  const dir = await mkdtemp(resolve(tmpdir(), 'hive-cli-schema-results-'));
  const schemaPath = resolve(dir, 'schema.graphql');
  await writeFile(schemaPath, 'type Query { hello: String }');

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const { port } = server.address() as AddressInfo;
    const result = await execa(
      binPath,
      args.map(arg => (arg === '$SCHEMA' ? schemaPath : arg)),
      {
        reject: false,
        cwd: dir,
        env: {
          HIVE_REGISTRY: `http://127.0.0.1:${port}/graphql`,
          HIVE_TOKEN: 'test-token',
          HIVE_NO_ERROR_TIP: '1',
          OCLIF_COLUMNS: '1000',
          NODE_OPTIONS: '--no-deprecation',
          ...env,
        },
      },
    );
    return { ...result, requests };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
    });
    await rm(dir, { recursive: true, force: true });
  }
}

const schemaCheck = { id: 'check-id', webUrl: 'https://app.graphql-hive.com/check' };

function checkResponse(schemaCheckPayload: object) {
  return () => ({ data: { schemaCheck: schemaCheckPayload } });
}

function publishResponse(schemaPublishPayload: object) {
  return () => ({ data: { schemaPublish: schemaPublishPayload } });
}

const githubCheckArgs = ['schema:check', '$SCHEMA', '--github', '--commit', 'abc', '--author', 'a'];
const publishArgs = ['schema:publish', '$SCHEMA', '--commit', 'abc', '--author', 'a'];

describe('schema:check --github', () => {
  test('a passing check exits with 0', async () => {
    const result = await runAgainstRegistry(
      checkResponse({
        __typename: 'GitHubSchemaCheckSuccess',
        message: 'Check-run created',
        isValid: true,
        schemaCheck,
      }),
      githubCheckArgs,
      githubEnv,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Check-run created');
    expect(result.stdout).toContain(schemaCheck.webUrl);
    expect(result.requests[0].operationName).toBe('CLI_SchemaCheckGitHubMutation');
  });

  test('a failed check exits with 1 and error code 202', async () => {
    const result = await runAgainstRegistry(
      checkResponse({
        __typename: 'GitHubSchemaCheckSuccess',
        message: 'Check-run created',
        valid: false,
        schemaCheck,
      }),
      githubCheckArgs,
      githubEnv,
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Schema check failed.  [202]');
    expect(result.stdout).toContain(schemaCheck.webUrl);
  });

  test('a failed check is approved with --forceSafe', async () => {
    const result = await runAgainstRegistry(
      request =>
        request.operationName === 'approveFailedSchemaCheck'
          ? { data: { approveFailedSchemaCheck: { ok: { schemaCheck: { id: 'check-id' } } } } }
          : {
              data: {
                schemaCheck: {
                  __typename: 'GitHubSchemaCheckSuccess',
                  message: 'Check-run created',
                  valid: false,
                  schemaCheck,
                },
              },
            },
      [...githubCheckArgs, '--forceSafe', '--target', 'org/project/target'],
      githubEnv,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Breaking changes were expected (forced)');
    expect(result.requests[1].operationName).toBe('approveFailedSchemaCheck');
    expect(result.requests[1].variables.input.schemaCheckId).toBe('check-id');
  });

  test('--forceSafe requires a target slug', async () => {
    const result = await runAgainstRegistry(
      checkResponse({
        __typename: 'GitHubSchemaCheckSuccess',
        message: 'Check-run created',
        valid: false,
        schemaCheck,
      }),
      [...githubCheckArgs, '--forceSafe', '--target', 'a0f4c605-6541-4350-8cfe-b31f21a4bf80'],
      githubEnv,
    );

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('requires the target as a slug');
    expect(result.stderr).toContain('[102]');
  });
});

describe('schema:check', () => {
  test('a failed check exits with 1 and error code 202', async () => {
    const result = await runAgainstRegistry(
      checkResponse({
        __typename: 'SchemaCheckError',
        valid: false,
        changes: { edges: [] },
        warnings: { nodes: [], total: 0 },
        errors: { edges: [{ node: { message: 'Something is broken' } }] },
        schemaCheck,
      }),
      ['schema:check', '$SCHEMA'],
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('Something is broken');
    expect(result.stderr).toContain('Schema check failed.  [202]');
    expect(result.requests[0].operationName).toBe('CLI_SchemaCheckMutation');
    expect(result.requests[0].query).toMatch(/on GitHubSchemaCheckSuccess \{\s*message\s*\}/);
  });

  test('--forceSafe fails when no schema check was stored', async () => {
    const result = await runAgainstRegistry(
      checkResponse({
        __typename: 'SchemaCheckError',
        valid: false,
        changes: null,
        warnings: null,
        errors: { edges: [{ node: { message: 'Missing service name' } }] },
        schemaCheck: null,
      }),
      ['schema:check', '$SCHEMA', '--forceSafe', '--target', 'org/project/target'],
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('[203]');
  });

  test('a missing permission is an access denied error', async () => {
    const result = await runAgainstRegistry(
      () => ({
        errors: [
          {
            message: `No access (reason: "Missing permission for performing 'schemaCheck:create' on resource")`,
            extensions: { code: 'UNAUTHORISED' },
          },
        ],
      }),
      ['schema:check', '$SCHEMA'],
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('"schemaCheck:create" permission');
    expect(result.stderr).toContain('[124]');
  });

  test('a server that does not know a field is an unsupported server error', async () => {
    const result = await runAgainstRegistry(
      () => ({
        errors: [{ message: 'Cannot query field "valid" on type "GitHubSchemaCheckSuccess".' }],
      }),
      githubCheckArgs,
      githubEnv,
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('[125]');
  });
});

describe('schema:publish --github', () => {
  test('a publish rejected before a check-run is created prints the reason', async () => {
    const result = await runAgainstRegistry(
      publishResponse({
        __typename: 'SchemaPublishError',
        valid: false,
        linkToWebsite: null,
        changes: null,
        errors: { edges: [{ node: { message: "Schema revision 'abc' was not found." } }] },
      }),
      [...publishArgs, '--github'],
      githubEnv,
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/Schema revision \S*abc\S* was not found\./);
    expect(result.stderr).toContain('[300]');
  });

  test('an accepted publish exits with 0', async () => {
    const result = await runAgainstRegistry(
      publishResponse({
        __typename: 'GitHubSchemaPublishSuccess',
        message: 'No breaking changes',
        isValid: true,
      }),
      [...publishArgs, '--github'],
      githubEnv,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('No breaking changes');
    expect(result.requests[0].operationName).toBe('CLI_SchemaPublishGitHubMutation');
  });

  test('a rejected publish exits with 1 and error code 300', async () => {
    const result = await runAgainstRegistry(
      publishResponse({
        __typename: 'GitHubSchemaPublishSuccess',
        message: 'Detected 1 error',
        isValid: false,
      }),
      [...publishArgs, '--github'],
      githubEnv,
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('Detected 1 error');
    expect(result.stderr).toContain('[300]');
  });
});

describe('schema:publish', () => {
  test('a publish rejected by --fail-on-composition-error exits with 1 and error code 300', async () => {
    const result = await runAgainstRegistry(
      publishResponse({
        __typename: 'SchemaPublishError',
        valid: false,
        linkToWebsite: null,
        changes: null,
        errors: { edges: [{ node: { message: 'Composition failed' } }] },
      }),
      [...publishArgs, '--fail-on-composition-error'],
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('Composition failed');
    expect(result.stderr).toContain('[300]');
    expect(result.requests[0].operationName).toBe('schemaPublish');
    expect(result.requests[0].query).toMatch(/on GitHubSchemaPublishSuccess \{\s*message\s*\}/);
  });

  test('a file together with --revision is a conflicting options error', async () => {
    const result = await runAgainstRegistry(publishResponse({}), [
      ...publishArgs,
      '--revision',
      'abc',
    ]);

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('[123]');
    expect(result.requests).toHaveLength(0);
  });
});

describe('schema:push', () => {
  test('pushing an existing revision with the same schema succeeds', async () => {
    const result = await runAgainstRegistry(
      () => ({
        data: {
          schemaPush: {
            ok: {
              schemaRevision: {
                service: 'products',
                revision: 'abc',
                digest: 'hive-sdl-v1:sha256:123',
                expiresAt: '2026-10-24T00:00:00.000Z',
              },
            },
            error: null,
          },
        },
      }),
      ['schema:push', '$SCHEMA', '--target', 'org/project/target', '--revision', 'abc'],
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Schema revision pushed.');
    expect(result.stdout).toContain('Expires: 2026-10-24T00:00:00.000Z');
    expect(result.stderr).not.toContain('Skipping');
  });
});
