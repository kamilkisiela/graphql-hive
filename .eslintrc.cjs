/* eslint-env node */
const guildConfig = require('@theguild/eslint-config/base');

const rulesToExtends = Object.fromEntries(
  Object.entries(guildConfig.rules).filter(([key]) =>
    [
      'no-implicit-coercion',
      'simple-import-sort/imports',
      'import/first',
      'no-restricted-globals',
      '@typescript-eslint/no-unused-vars',
      'unicorn/no-useless-fallback-in-spread',
      'unicorn/no-array-push-push',
      'no-else-return',
      'no-lonely-if',
      'unicorn/prefer-includes',
      'react/self-closing-comp',
      'prefer-const',
      'no-extra-boolean-cast',
      'no-restricted-syntax',
    ].includes(key),
  ),
);

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
        devDependencies: ['packages/services/storage/tools/*.js', 'packages/services/**'],
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
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    ...rulesToExtends,

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
      files: ['packages/web/**'],
      extends: [
        '@theguild',
        '@theguild/eslint-config/react',
        'plugin:tailwindcss/recommended',
        'plugin:@next/next/recommended',
      ],
      settings: {
        react: {
          version: 'detect',
        },
      },
      rules: {
        // conflicts with official prettier-plugin-tailwindcss and tailwind v3
        'tailwindcss/classnames-order': 'off',
        // set more strict to highlight in editor
        'tailwindcss/enforces-shorthand': 'error',
        'react/display-name': 'off',
        'react/prop-types': 'off',
        'react/no-unknown-property': 'off',
        'jsx-a11y/anchor-is-valid': ['off', { components: ['Link', 'NextLink'] }],
        'jsx-a11y/alt-text': ['warn', { elements: ['img'], img: ['Image', 'NextImage'] }],
        'simple-import-sort/exports': 'error',

        // TODO: enable below rules👇
        '@typescript-eslint/consistent-type-imports': ['off', { prefer: 'no-type-imports' }],
        'tailwindcss/no-custom-classname': 'off',
        'tailwindcss/migration-from-tailwind-2': 'off',
        'no-console': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'react/jsx-no-useless-fragment': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-restricted-imports': 'off',
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
        'tailwindcss/no-contradicting-classname': 'off',
      },
    },
    {
      files: ['packages/web/app/**'],
      settings: {
        next: {
          rootDir: 'packages/web/app',
        },
        tailwindcss: {
          config: 'packages/web/app/tailwind.config.js',
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
      },
    },
    {
      files: ['packages/web/docs/**'],
      settings: {
        next: {
          rootDir: 'packages/web/docs',
        },
        tailwindcss: {
          config: 'packages/web/docs/tailwind.config.cjs',
        },
      },
    },
    {
      files: ['packages/web/landing-page/**'],
      settings: {
        next: {
          rootDir: 'packages/web/landing-page',
        },
        tailwindcss: {
          config: 'packages/web/landing-page/tailwind.config.cjs',
        },
      },
    },
    {
      files: 'cypress/**',
      extends: 'plugin:cypress/recommended',
    },
  ],
};
