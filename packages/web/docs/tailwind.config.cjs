const config = require('@theguild/tailwind-config');
const { fontFamily } = require('tailwindcss/defaultTheme');

module.exports = {
  ...config,
  theme: {
    ...config.theme,
    extend: {
      ...config.theme.extend,
      fontFamily: {
        sans: ['var(--font-sans)', ...fontFamily.sans],
        display: ['var(--font-sans)', ...fontFamily.sans],
      },
    },
  },
};
