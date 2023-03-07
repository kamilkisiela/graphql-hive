const { plugins, ...prettierConfig } = require('@theguild/prettier-config');

module.exports = {
  ...prettierConfig,
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
