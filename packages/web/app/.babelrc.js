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
  plugins: ['@emotion/babel-plugin', [babelPlugin, { artifactDirectory: './src/gql' }]],
};
