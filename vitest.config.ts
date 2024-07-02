import tsconfigPaths from 'vite-tsconfig-paths';
import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    alias: {
      '@graphql-hive/core': new URL('./packages/libraries/core/src/index.ts', import.meta.url)
        .pathname,
    },
    globals: true,
    exclude: [
      ...defaultExclude,
      'integration-tests',
      'packages/migrations/test',
      'docker/.hive-dev',
    ],
    setupFiles: ['./scripts/serializer.ts'],
  },
});
