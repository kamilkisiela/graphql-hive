const { plugins, ...prettierConfig } = require('@theguild/prettier-config');

module.exports = {
  ...prettierConfig,
  plugins: [
    ...plugins,
    // For sort CSS classes
    require('prettier-plugin-tailwindcss'),
  ],
};
