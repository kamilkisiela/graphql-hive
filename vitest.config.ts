import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    alias: {
      '@hive/usage-common': new URL(
        './packages/services/usage-common/src/index.ts',
        import.meta.url,
      ).pathname,
      '@hive/service-common': new URL(
        './packages/services/service-common/src/index.ts',
        import.meta.url,
      ).pathname,
      '@graphql-hive/core': new URL('./packages/libraries/core/src/index.ts', import.meta.url)
        .pathname,
    },
    exclude: [...defaultExclude, 'integration-tests', 'packages/migrations/test'],
    setupFiles: ['./scripts/serializer.ts'],
  },
});
