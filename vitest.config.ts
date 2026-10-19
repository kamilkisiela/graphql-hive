import tsconfigPaths from 'vite-tsconfig-paths';
import { defaultExclude, defineConfig } from 'vitest/config';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';

export default defineConfig({
  // Lets specs import the app's `*.css.ts` files.
  plugins: [tsconfigPaths(), vanillaExtractPlugin()],
  test: {
    alias: {
      '@graphql-hive/core': new URL('./packages/libraries/core/src/index.ts', import.meta.url)
        .pathname,
      // Both packages publish from `dist`, which tests do not build; resolve them from source so a
      // spec that pulls one in (directly or through the app's route tree) needs no build step.
      '@graphql-hive/laboratory': new URL(
        './packages/libraries/laboratory/src/index.tsx',
        import.meta.url,
      ).pathname,
    },
    globals: true,
    exclude: [
      ...defaultExclude,
      'e2e',
      'integration-tests',
      'packages/migrations/test',
      'docker/.hive-dev',
    ],
    setupFiles: ['./scripts/serializer.ts'],
  },
});
