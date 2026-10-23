/* eslint-env node */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const guildConfig = require('@theguild/eslint-config/base');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { REACT_RESTRICTED_SYNTAX, RESTRICTED_SYNTAX } = require('@theguild/eslint-config/constants');
// An override replaces the rule's options, so the react entries come along explicitly.
const [, ...GUILD_REACT_RESTRICTED_IMPORTS] =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('@theguild/eslint-config/react-base').rules['@typescript-eslint/no-restricted-imports'];
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
    'packages/web/app/.ladle/**',
    'public',
    'packages/web/app/src/graphql/index.ts',
    'packages/libraries/cli/src/sdk.ts',
    'packages/libraries/cli/src/gql/**/*',
    'packages/services/storage/src/db/types.ts',
    'packages/web/app/src/gql/**/*',
    'codegen.mts',
    'tsup',
    'packages/libraries/render-laboratory/src/laboratory.ts',
    'packages/web/app/vite.config.ts',
  ],
  overrides: [
    {
      // Setup GraphQL Parser
      files: '*.{graphql,gql}',
      parser: '@graphql-eslint/eslint-plugin',
      plugins: ['@graphql-eslint'],
      parserOptions: {
        graphQLConfig: {
          schema: SCHEMA_PATH,
          documents: OPERATIONS_PATHS,
        },
      },
      rules: {
        '@graphql-eslint/no-deprecated': 'error',
        '@graphql-eslint/require-selections': ['error', { fieldName: ['id'] }],
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
        '@graphql-eslint/no-deprecated': 'error',
        '@graphql-eslint/require-selections': ['error', { fieldName: ['id'] }],
      },
    },
    {
      files: ['*.cjs'],
      parserOptions: { ecmaVersion: 2020 },
    },
    {
      files: [
        'packages/**/*.ts',
        'packages/**/*.tsx',
        'e2e/**/*.ts',
        'e2e/**/*.tsx',
        'playwright.config.ts',
      ],
      reportUnusedDisableDirectives: true,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: [path.join(__dirname, './tsconfig.eslint.json')],
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
              'e2e/**/*.ts',
              // We bundle it all anyway, so there are no node_modules
              'packages/libraries/laboratory/**',
              'playwright.config.ts',
              '**/*.spec.ts',
              '**/*.test.ts',
              '**/*.e2e.ts',
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
        'sonarjs/no-unused-collection': 'warn',
        'sonarjs/no-inverted-boolean-check': 'warn',
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
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            caughtErrors: 'none',
            caughtErrorsIgnorePattern: '^_',
            destructuredArrayIgnorePattern: '^_',
            varsIgnorePattern: '^_',
          },
        ],
      },
    },
    {
      files: ['packages/web/**'],
      extends: [
        '@theguild',
        '@theguild/eslint-config/react',
        'plugin:better-tailwindcss/legacy-recommended',
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
        'better-tailwindcss/enforce-consistent-class-order': 'off',
        'better-tailwindcss/enforce-canonical-classes': 'off',
        // keeping classes in one line helps prettier-plugin-tailwindcss
        // enable wrapping in text editors to make classes human readable
        'better-tailwindcss/enforce-consistent-line-wrapping': 'off',
        'better-tailwindcss/enforce-shorthand-classes': 'off',
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
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'off',
        'unicorn/filename-case': 'off',
        'import/no-default-export': 'off',
        '@next/next/no-img-element': 'off',
        '@typescript-eslint/ban-types': 'off',
        'jsx-a11y/label-has-associated-control': 'off',
        'jsx-a11y/click-events-have-key-events': 'off',
        'jsx-a11y/no-static-element-interactions': 'off',
        '@next/next/no-html-link-for-pages': 'off',
        'unicorn/no-negated-condition': 'off',
        'no-implicit-coercion': 'off',

        'react/jsx-key': 'warn',
      },
    },
    {
      files: ['packages/web/app/**'],
      settings: {
        'better-tailwindcss': {
          // tailwindcss 4: the path to the entry file of the css based tailwind config (eg: `src/global.css`)
          entryPoint: 'packages/web/app/src/index.css',
          callees: tailwindCallees,
        },
      },
      rules: {
        // better-tailwindcss assumes you're using v4...we're being explicit here due to our dual tailwind setups
        'better-tailwindcss/no-deprecated-classes': 'error',
        // Tailwind v4 uses CSS variables without var() syntax
        'better-tailwindcss/enforce-consistent-variable-syntax': 'off',
        'better-tailwindcss/no-unknown-classes': [
          'error',
          {
            ignore: [
              'drag-none',
              // Animation utilities (from index.css, replaces tailwindcss-animate)
              'animate-in',
              'animate-out',
              'fade-in-.*',
              'fade-out-.*',
              'zoom-in-.*',
              'zoom-out-.*',
              'slide-in-from-.*',
              'slide-out-to-.*',
              // Custom radius from @theme
              'rounded-xs',
              // ring-offset with semantic colors
              'ring-offset-.*',
              // Data attribute variants with custom animations (for Radix UI components)
              'data-\\[side=(top|right|bottom|left)\\]:animate-slide-(up|down|left|right)-fade',
              // GraphiQL classes
              'graphiql-.*',
              // hive classes
              'hive-.*',
              // Schema diff custom classes (defined in index.css)
              'schema-doc-row-.*',
              // No scrollbar utility (defined in index.css)
              'no-scrollbar',
              // Tailwind v4 CSS variable syntax with parentheses
              '.*-\\(--.*\\)',
            ],
          },
        ],
      },
    },
    {
      // The routing patterns, see packages/web/app/docs/ROUTER.md: a route renders its layout
      // around an outlet and pages render inside it, and the router instance belongs to main.tsx.
      files: ['packages/web/app/src/**/*.{ts,tsx}'],
      excludedFiles: [
        'packages/web/app/src/routes/**',
        'packages/web/app/src/main.tsx',
        'packages/web/app/src/lib/testing/**',
        'packages/web/app/src/**/*.spec.{ts,tsx}',
      ],
      rules: {
        '@typescript-eslint/no-restricted-imports': [
          'error',
          {
            paths: [
              ...GUILD_REACT_RESTRICTED_IMPORTS,
              ...['organization', 'project', 'target'].map(layout => ({
                name: `@/components/layouts/${layout}`,
                message:
                  'The route in src/routes renders this layout around its <Outlet/>; a page renders <LayoutContent> inside it.',
                allowTypeImports: true,
              })),
              {
                name: '@/router',
                message:
                  "Only main.tsx mounts the router. Read route state with getRouteApi(<route id>) and navigate with a route API's useNavigate.",
              },
            ],
          },
        ],
      },
    },
    {
      files: [
        // Foundry mounts a preview's `render` as a component, so hooks inside it are legitimate,
        // but the rule only recognises a component by a capitalised name.
        'packages/web/app/**/*.preview.tsx',
        'packages/libraries/laboratory/dev/previews/**/*.preview.tsx',
        'packages/web/docs/**',
      ],
      rules: {
        'react-hooks/rules-of-hooks': 'off',
      },
    },
    {
      files: ['packages/web/docs/**'],
      settings: {
        next: {
          rootDir: 'packages/web/docs',
        },
        'better-tailwindcss': {
          // tailwindcss 3: the path to the tailwind config file (eg: `tailwind.config.js`)
          tailwindConfig: 'packages/web/docs/tailwind.config.ts',
          callees: tailwindCallees,
        },
      },
      rules: {
        'import/extensions': 'off',
        // better-tailwindcss assumes you're using v4...we're being explicit here due to our dual tailwind setups
        'better-tailwindcss/no-deprecated-classes': 'off',
        'better-tailwindcss/no-unknown-classes': [
          'error',
          {
            ignore: [
              'light',
              'hive-focus',
              'hive-focus-within',
              'nextra-focus',
              'nextra-scrollbar',
              'no-scrollbar', // from Nextra
              'hive-slider',
              'hive-prose',
              'subheader',
              'subheading-anchor',
              'duration-\\[.*\\]', // Allow arbitrary duration values like duration-[.8s]
              'ease-\\[var\\(--.*\\)\\]', // Allow CSS variables in arbitrary ease values
              'x:.*', // Allow Nextra 4 custom variant prefix
            ],
          },
        ],
        // Allow CSS variables in arbitrary values for Tailwind v3
        'better-tailwindcss/enforce-consistent-variable-syntax': 'off',
      },
    },
    {
      files: [
        // environment should be parsed to avoid global dependencies and sacred .env files
        'packages/**/environment.ts',
        // - environment is inlined and must be "registered" in next.config.js
        // - `import.meta.env` is not supported in Next.js yet
        'packages/web/docs/**',
        'e2e/**/*.ts',
        'playwright.config.ts',
      ],
      rules: {
        'no-process-env': 'off',
      },
    },
  ],
};
