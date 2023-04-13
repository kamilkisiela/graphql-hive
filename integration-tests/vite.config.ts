import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    alias: {
      '@app/gql/graphql': 'testkit/gql/graphql.ts',
      '@app/gql': 'testkit/gql/index.ts',
    },
    setupFiles: ['dotenv/config', '../scripts/serializer.ts'],
    testTimeout: 90_000,
  },
});
