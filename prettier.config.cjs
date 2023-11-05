const { plugins, ...prettierConfig } = require('@theguild/prettier-config');
/**
 * @type {import('prettier').Config}
 */

module.exports = {
  ...prettierConfig,
  importOrderParserPlugins: ['importAssertions', ...prettierConfig.importOrderParserPlugins],
  plugins: [
    'prettier-plugin-sql',
    ...plugins,
    // For sort CSS classes.
    // Make sure to keep this one last, see: https://github.com/tailwindlabs/prettier-plugin-tailwindcss#compatibility-with-other-prettier-plugins
    'prettier-plugin-tailwindcss',
  ],
  // prettier-plugin-sql options
  language: 'postgresql',
  keywordCase: 'upper',
};
