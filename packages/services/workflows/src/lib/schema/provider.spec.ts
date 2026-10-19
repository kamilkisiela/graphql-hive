import { Logger } from '@graphql-hive/logger';
import type { PostgresDatabasePool } from '@hive/postgres';
import { createSchemaObject, schemaProvider } from './provider.js';

function createSchemaProvider() {
  return schemaProvider({
    schemaServiceUrl: 'http://schema.localhost',
    logger: new Logger({ level: false }),
  });
}

describe('latestComposableSchemas', () => {
  const targetId = 'c0b7f2ce-6f4a-4b58-9c6e-2a1d4f7e9b10';

  test('returns no schemas and skips the schema log query when the target has no composable version', async () => {
    const any = vi.fn();
    const pool = {
      maybeOneFirst: async () => null,
      any,
    } as unknown as PostgresDatabasePool;

    await expect(
      createSchemaProvider().latestComposableSchemas({ targetId, pool }),
    ).resolves.toEqual([]);
    expect(any).not.toHaveBeenCalled();
  });
});

describe('composeAndValidate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('sends the request id of the task to the schema service', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            data: {
              errors: [],
              sdl: null,
              supergraph: null,
              contracts: null,
              tags: null,
              schemaMetadata: null,
              metadataAttributes: null,
            },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await createSchemaProvider().composeAndValidate(
      'SINGLE',
      [createSchemaObject({ sdl: 'type Query { a: String }' })],
      { external: { enabled: false }, native: false, contracts: null },
      { requestId: 'abc' },
    );

    const [, init] = fetchSpy.mock.calls[0];
    expect(new Headers(init?.headers).get('x-request-id')).toBe('abc');
  });
});
