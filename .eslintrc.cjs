/* eslint-env node */
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const { builtinModules } = require('module');

module.exports = {
  reportUnusedDisableDirectives: true,
  ignorePatterns: [
    'scripts',
    'rules',
    'out',
    'public',
    'packages/web/app/src/graphql/index.ts',
    'packages/libraries/cli/src/sdk.ts',
    'packages/services/storage/src/db/types.ts',
    'babel.config.cjs',
    'jest.config.js',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.eslint.json', './deployment/tsconfig.json'],
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import', 'hive'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'no-restricted-globals': ['error', 'stop'],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    'no-empty': ['error', { allowEmptyCatch: true }],

    'import/no-absolute-path': 'error',
    'import/no-self-import': 'error',
    'import/no-unused-modules': [
      process.env.CI === 'true' ? 'warn' : 'off',
      {
        unusedExports: true,
        missingExports: true,
      },
    ],
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['packages/services/storage/tools/*.js', 'packages/services/**'],
        optionalDependencies: false,
      },
    ],
    'import/first': 'error',
    'hive/enforce-deps-in-dev': [
      'error',
      {
        scopes: ['@hive', '@graphql-hive'],
        ignored: ['packages/libraries/**', 'packages/web/**'],
      },
    ],
    '@typescript-eslint/no-floating-promises': 'error',

    // 🚨 The following rules needs to be fixed and was temporarily disabled to avoid printing warning
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/triple-slash-reference': 'off',
  },
  overrides: [
    {
      files: ['packages/web/**', 'packages/services/cdn-worker/**', 'packages/services/police-worker/**'],
      rules: {
        // because this folder is excluded in tsconfig.json
        '@typescript-eslint/no-floating-promises': 'off',
      },
      parserOptions: {
        // Fixes Parsing error: "parserOptions.project" has been set for @typescript-eslint/parser
        createDefaultProgram: true,
      },
    },
    {
      files: ['twin.d.ts', 'next-env.d.ts', '*.spec.ts'],
      rules: {
        'import/no-unused-modules': 'off',
      },
    },
    {
      // TODO: replace with packages/web/**
      files: ['packages/web/app/src/components/v2/**', 'packages/web/app/pages/\\[orgId\\]/**'],
      extends: [
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
        'plugin:tailwindcss/recommended',
        'plugin:jsx-a11y/recommended',
        'plugin:@next/next/recommended',
      ],
      plugins: ['simple-import-sort'],
      settings: {
        tailwindcss: {
          config: 'packages/app/tailwind.config.js',
          whitelist: [
            'drag-none',
            'placeholder-gray-500',
            'fill-none',
            'wrapper',
            'line-clamp-1',
            'line-clamp-2',
            'line-clamp-3',
            '-z-1',
          ],
        },
        react: {
          version: 'detect',
        },
      },
      rules: {
        // conflicts with official prettier-plugin-tailwindcss and tailwind v3
        'tailwindcss/classnames-order': 'off',
        // set more strict to highlight in editor
        'tailwindcss/no-custom-classname': 'error',
        'tailwindcss/enforces-shorthand': 'error',
        'tailwindcss/migration-from-tailwind-2': 'error',
        // in React@17, import React is no longer required
        'react/react-in-jsx-scope': 'off',
        'react/display-name': 'off',
        'react/prop-types': 'off',
        'react/no-unescaped-entities': 'off',
        'react/jsx-curly-brace-presence': 'error',
        'jsx-a11y/anchor-is-valid': ['off', { components: ['Link', 'NextLink'] }],
        'jsx-a11y/alt-text': ['warn', { elements: ['img'], img: ['Image', 'NextImage'] }],
        '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'no-type-imports' }],
        'simple-import-sort/exports': 'error',
        'simple-import-sort/imports': [
          'error',
          {
            groups: [
              [
                // Node.js builtins
                `^(node:)?(${builtinModules
                  .filter(mod => !mod.startsWith('_') && !mod.includes('/'))
                  .join('|')})(/.*|$)`,
                '^react(-dom)?$',
                '^next(/.*|$)',
                '^graphql(/.*|$)',
                // Side effect imports.
                '^\\u0000',
                // Packages.
                // Things that start with a letter (or digit or underscore), or `@` followed by a letter.
                '^@?\\w',
              ],
              [
                // Absolute imports and other imports such as Vue-style `@/foo`.
                // Anything not matched in another group.
                '^',
                // Relative imports.
                // Anything that starts with a dot.
                '^\\.',
                // Style imports.
                '^.+\\.css$',
              ],
            ],
          },
        ],
      },
    },
  ],
};
