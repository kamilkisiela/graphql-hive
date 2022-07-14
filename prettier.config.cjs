const { plugins, ...prettierConfig } = require('@theguild/prettier-config');

module.exports = {
  ...prettierConfig,
  plugins: [
    // ...plugins, Look: #218
    // For sort CSS classes
    require('prettier-plugin-tailwindcss'),
  ],
};
