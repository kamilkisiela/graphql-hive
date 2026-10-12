import { Logger } from '@graphql-hive/logger';
import type { PostgresDatabasePool } from '@hive/postgres';
import { schemaProvider } from './provider.js';

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
