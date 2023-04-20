import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    alias: {
      '@hive/usage-common': 'packages/services/usage-common/src/index.ts',
      '@hive/service-common': 'packages/services/service-common/src/index.ts',
      '@graphql-hive/core': 'packages/libraries/core/src/index.ts',
    },
    exclude: [...defaultExclude, 'integration-tests', 'packages/migrations/test'],
    setupFiles: ['./scripts/serializer.ts'],
  },
});
