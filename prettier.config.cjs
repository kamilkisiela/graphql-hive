const { plugins, ...prettierConfig } = require('@theguild/prettier-config');
/**
 * @type {import('prettier').Config}
 */
module.exports = {
  ...prettierConfig,
  importOrderParserPlugins: ['importAssertions', ...prettierConfig.importOrderParserPlugins],
  plugins: [
    require('prettier-plugin-sql'),
    // For sort CSS classes
    require('prettier-plugin-tailwindcss'),
    ...plugins,
  ],
  // prettier-plugin-sql options
  language: 'postgresql',
  keywordCase: 'upper',
};
