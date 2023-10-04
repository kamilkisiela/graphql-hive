/* eslint-env node */

const SCHEMA_PATH = './packages/services/api/src/modules/*/module.graphql.ts';
const OPERATIONS_PATHS = [
  './packages/web/app/**/*.ts',
  './packages/web/app/**/*.tsx',
  './packages/web/app/**/*.graphql',
];

module.exports = {
  reportUnusedDisableDirectives: true,
  ignorePatterns: [
    'scripts',
    'rules',
    'out',
    '.hive',
    'public',
    'packages/web/app/src/graphql/index.ts',
    'packages/libraries/cli/src/sdk.ts',
    'packages/libraries/cli/src/gql/**/*',
    'packages/services/storage/src/db/types.ts',
    'packages/web/app/src/gql/**/*',
    'codegen.cjs',
    'tsup',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: ['./tsconfig.eslint.json'],
  },
  parser: '@typescript-eslint/parser',
  rules: {},
  overrides: [
    {
      // Setup GraphQL Parser
      files: '*.{graphql,gql}',
      parser: '@graphql-eslint/eslint-plugin',
      plugins: ['@graphql-eslint'],
      parserOptions: {
        schema: SCHEMA_PATH,
        operations: OPERATIONS_PATHS,
      },
    },
    {
      // Setup processor for operations/fragments definitions on code-files
      files: ['packages/web/app/**/*.tsx', 'packages/web/app/**/*.ts'],
      processor: '@graphql-eslint/graphql',
    },
    {
      files: [
        'packages/web/app/**/*.tsx',
        'packages/web/app/**/*.ts',
        'packages/web/app/**/*.graphql',
      ],
      plugins: ['@graphql-eslint'],
      rules: {
        '@graphql-eslint/require-id-when-available': 'error',
      },
    },
  ],
};
