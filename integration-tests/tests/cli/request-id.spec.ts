import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { execa } from '@esm2cjs/execa';

const binPath = resolve(__dirname, '../../../packages/libraries/cli/bin/run');

/**
 * Runs a schema check against a fake registry that answers every request with `respond`,
 * and returns the CLI's error output with the terminal line wrapping undone.
 */
async function schemaCheckAgainst(
  respond: (request: IncomingMessage, response: ServerResponse) => void,
): Promise<string> {
  const server = createServer(respond);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const { port } = server.address() as AddressInfo;
    const result = await execa(
      binPath,
      [
        'schema:check',
        '--registry.endpoint',
        `http://127.0.0.1:${port}/graphql`,
        '--registry.accessToken',
        'test-token',
        '--target',
        'org/project/target',
        'fixtures/init-schema.graphql',
      ],
      { env: { NODE_OPTIONS: '--no-deprecation' }, reject: false },
    );
    expect(result.exitCode).not.toBe(0);
    return `${result.stdout}\n${result.stderr}`.replace(/\s*\n\s*›\s+/g, ' ');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
    });
  }
}

test('prints the request id of the registry when the request is rejected with an HTTP error', async () => {
  const message = await schemaCheckAgainst((_request, response) => {
    response.statusCode = 413;
    response.setHeader('content-type', 'application/json');
    response.setHeader('x-request-id', 'registry-request-id-413');
    response.end(
      JSON.stringify({
        errors: [
          { message: 'Request body too large', extensions: { code: 'REQUEST_ENTITY_TOO_LARGE' } },
        ],
      }),
    );
  });

  expect(message).toContain('Status: 413');
  expect(message).toContain('Request ID: "registry-request-id-413"');
});

test('prints the request id of the registry when the response contains GraphQL errors', async () => {
  const message = await schemaCheckAgainst((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.setHeader('x-request-id', 'registry-request-id-graphql');
    response.end(JSON.stringify({ errors: [{ message: 'Unexpected error.' }] }));
  });

  expect(message).toContain('Request ID: "registry-request-id-graphql"');
});
