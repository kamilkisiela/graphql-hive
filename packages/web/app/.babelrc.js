const { babelPlugin } = require('@graphql-codegen/gql-tag-operations-preset');

module.exports = {
  presets: [
    [
      'next/babel',
      {
        'preset-react': {
          runtime: 'automatic',
          importSource: '@emotion/react',
        },
      },
    ],
  ],
  plugins: [
    '@emotion/babel-plugin',
    'babel-plugin-macros',
    [babelPlugin, { artifactDirectory: './src/gql' }],
  ],
};
