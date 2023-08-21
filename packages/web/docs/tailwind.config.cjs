const config = require('@theguild/tailwind-config');
const { fontFamily } = require('tailwindcss/defaultTheme');

module.exports = {
  ...config,
  theme: {
    ...config.theme,
    extend: {
      ...config.extend,
      fontFamily: {
        display: [
          'Inter var,' + fontFamily.sans.join(','),
          {
            fontFeatureSettings: 'normal',
            fontVariationSettings: '"opsz" 32',
          },
        ],
      },
    },
  },
};
