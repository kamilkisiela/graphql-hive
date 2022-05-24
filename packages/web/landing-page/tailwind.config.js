// tailwind.config.js
const colors = require('tailwindcss/colors');

module.exports = {
  theme: {
    fontFamily: {
      title: ['Inter', 'ui-sans-serif', 'system-ui'],
    },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: colors.white,
      black: colors.black,
      gray: colors.warmGray,
      red: colors.red,
      yellow: colors.yellow,
      emerald: colors.emerald,
      orange: colors.orange,
    },
  },
};
