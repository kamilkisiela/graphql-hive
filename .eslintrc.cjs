/* eslint-env node */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const guildConfig = require('@theguild/eslint-config/base');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { REACT_RESTRICTED_SYNTAX, RESTRICTED_SYNTAX } = require('@theguild/eslint-config/constants');
const path = require('path');

const SCHEMA_PATH = './packages/services/api/src/modules/*/module.graphql.ts';
const OPERATIONS_PATHS = [
  './packages/web/app/**/*.ts',
  './packages/web/app/**/*.tsx',
  './packages/web/app/**/*.graphql',
];

const rulesToExtends = Object.fromEntries(
  Object.entries(guildConfig.rules).filter(([key]) =>
    [
      'import/first',
      'no-restricted-globals',
      '@typescript-eslint/no-unused-vars',
      'unicorn/no-array-push-push',
      'no-else-return',
      'no-lonely-if',
      'unicorn/prefer-includes',
      'react/self-closing-comp',
      'no-extra-boolean-cast',
    ].includes(key),
  ),
);

const HIVE_RESTRICTED_SYNTAX = [
  {
    // ❌ '0.0.0.0' or `0.0.0.0`
    selector: ':matches(Literal[value="0.0.0.0"], TemplateElement[value.raw="0.0.0.0"])',
    message: 'Use "::" to make it compatible with both IPv4 and IPv6',
  },
];

const tailwindCallees = ['clsx', 'cn', 'cva', 'cx'];

/**
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
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
  // parserOptions: {
  //   ecmaVersion: 2020,
  //   sourceType: 'module',
  //   project: ['./tsconfig.eslint.json'],
  // },
  // parser: '@typescript-eslint/parser',
  // plugins: [...guildConfig.plugins, 'hive'],
  // extends: guildConfig.extends,
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
      files: ['packages/web/app/**/*.graphql'],
      plugins: ['@graphql-eslint'],
      rules: {
        '@graphql-eslint/require-id-when-available': 'error',
        '@graphql-eslint/no-deprecated': 'error',
      },
    },
    {
      files: ['packages/**/*.ts', 'packages/**/*.tsx', 'cypress/**/*.ts', 'cypress/**/*.tsx'],
      reportUnusedDisableDirectives: true,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: ['./tsconfig.eslint.json'],
      },
      parser: '@typescript-eslint/parser',
      plugins: [...guildConfig.plugins, 'hive'],
      extends: guildConfig.extends,
      rules: {
        'no-process-env': 'error',
        'no-empty': ['error', { allowEmptyCatch: true }],
        'import/no-absolute-path': 'error',
        'import/no-self-import': 'error',
        'import/no-extraneous-dependencies': [
          'error',
          {
            devDependencies: [
              'packages/services/storage/tools/*.js',
              'packages/services/**',
              'packages/migrations/**',
              // We bundle it all anyway, so there are no node_modules
              'packages/web/app/**',
              '**/*.spec.ts',
              '**/*.test.ts',
            ],
            optionalDependencies: false,
          },
        ],
        'hive/enforce-deps-in-dev': [
          'error',
          {
            scopes: ['@hive', '@graphql-hive'],
            ignored: ['packages/libraries/**', 'packages/web/**'],
          },
        ],
        '@typescript-eslint/no-floating-promises': 'error',
        ...rulesToExtends,
        'no-lonely-if': 'off',
        'object-shorthand': 'off',
        'no-restricted-syntax': ['error', ...HIVE_RESTRICTED_SYNTAX, ...RESTRICTED_SYNTAX],
        'prefer-destructuring': 'off',
        'prefer-const': 'off',
        'no-useless-escape': 'off',
        'no-inner-declarations': 'off',
        '@typescript-eslint/no-unnecessary-type-assertion': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-namespace': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/triple-slash-reference': 'off',
      },
    },
    {
      files: ['packages/web/**'],
      extends: [
        '@theguild',
        '@theguild/eslint-config/react',
        'plugin:tailwindcss/recommended',
        'plugin:@next/next/recommended',
      ],
      settings: {
        'import/resolver': {
          typescript: {
            project: ['packages/web/app/tsconfig.json'],
          },
        },
      },
      rules: {
        // conflicts with official prettier-plugin-tailwindcss and tailwind v3
        'tailwindcss/classnames-order': 'off',
        'tailwindcss/no-unnecessary-arbitrary-value': 'off',
        // set more strict to highlight in editor
        'tailwindcss/enforces-shorthand': 'error',
        'tailwindcss/no-custom-classname': 'error',
        'tailwindcss/migration-from-tailwind-2': 'error',
        'tailwindcss/no-contradicting-classname': 'error',
        'react/display-name': 'off',
        'react/prop-types': 'off',
        'react/no-unknown-property': 'off',
        'jsx-a11y/anchor-is-valid': ['off', { components: ['Link', 'NextLink'] }],
        'jsx-a11y/alt-text': ['warn', { elements: ['img'], img: ['Image', 'NextImage'] }],
        'no-restricted-syntax': ['error', ...HIVE_RESTRICTED_SYNTAX, ...REACT_RESTRICTED_SYNTAX],
        'prefer-destructuring': 'off',
        'no-console': 'off',
        'no-useless-escape': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'react/jsx-no-useless-fragment': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        'react-hooks/rules-of-hooks': 'off',
        'react-hooks/exhaustive-deps': 'off',
        'unicorn/filename-case': 'off',
        'import/no-default-export': 'off',
        '@next/next/no-img-element': 'off',
        '@typescript-eslint/ban-types': 'off',
        'react/jsx-key': 'off',
        'jsx-a11y/label-has-associated-control': 'off',
        'jsx-a11y/click-events-have-key-events': 'off',
        'jsx-a11y/no-static-element-interactions': 'off',
        '@next/next/no-html-link-for-pages': 'off',
        'unicorn/no-negated-condition': 'off',
        'no-implicit-coercion': 'off',
      },
    },
    {
      files: ['packages/web/app/**'],
      settings: {
        tailwindcss: {
          callees: tailwindCallees,
          config: path.join(__dirname, './packages/web/app/tailwind.config.cjs'),
          whitelist: ['drag-none'],
          cssFiles: ['packages/web/app/src/index.css', 'node_modules/graphiql/dist/style.css'],
        },
      },
    },
    // {
    //   files: ['packages/web/app/**'],
    //   excludedFiles: ['packages/web/app/src/pages/**'],
    //   rules: {
    //     'import/no-unused-modules': ['error', { unusedExports: true }],
    //   },
    // },
    {
      files: ['packages/web/docs/**'],
      settings: {
        next: {
          rootDir: 'packages/web/docs',
        },
        tailwindcss: {
          callees: tailwindCallees,
          whitelist: ['light', 'hive-focus', 'hive-focus-within'],
          config: path.join(__dirname, './packages/web/docs/tailwind.config.cjs'),
        },
      },
    },
    {
      files: 'cypress/**',
      extends: 'plugin:cypress/recommended',
    },
  ],
};
