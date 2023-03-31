const { babelPlugin } = require('@graphql-codegen/gql-tag-operations-preset');

module.exports = {
  presets: [['next/babel']],
  plugins: [[babelPlugin, { artifactDirectory: './src/gql' }]],
};
