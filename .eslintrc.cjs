/* eslint-env node */

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
    'packages/services/storage/src/db/types.ts',
    'babel.config.cjs',
    'jest.config.js',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: ['./tsconfig.eslint.json'],
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import', 'hive'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'no-process-env': 'error',
    'no-restricted-globals': ['error', 'stop'],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', ignoreRestSiblings: true },
    ],
    'no-empty': ['error', { allowEmptyCatch: true }],

    'import/no-absolute-path': 'error',
    'import/no-self-import': 'error',
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
        'react/no-unknown-property': 'off',
        'jsx-a11y/anchor-is-valid': ['off', { components: ['Link', 'NextLink'] }],
        'jsx-a11y/alt-text': ['warn', { elements: ['img'], img: ['Image', 'NextImage'] }],
        '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'no-type-imports' }],
        'simple-import-sort/exports': 'error',
      },
    },
    {
      files: 'cypress/**',
      extends: 'plugin:cypress/recommended',
    },
  ],
};
