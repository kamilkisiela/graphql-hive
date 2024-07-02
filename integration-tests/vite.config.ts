import { defineConfig } from 'vitest/config';

const setupFiles = ['../scripts/serializer.ts', './expect.ts'];

if (!process.env.DEV) {
  setupFiles.unshift('dotenv/config');
} else {
  setupFiles.unshift('./local-dev.ts');
}

export default defineConfig({
  test: {
    globals: true,
    alias: {
      'testkit/gql/graphql': new URL('./testkit/gql/graphql.ts', import.meta.url).pathname,
      'testkit/gql': new URL('./testkit/gql/index.ts', import.meta.url).pathname,
      '@hive/service-common': new URL(
        '../packages/services/service-common/src/index.ts',
        import.meta.url,
      ).pathname,
    },
    setupFiles,
    testTimeout: 90_000,
  },
});
