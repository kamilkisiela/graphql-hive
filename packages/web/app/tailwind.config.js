const colors = require('tailwindcss/colors');

module.exports = {
  darkMode: 'class',
  corePlugins: {
    fontFamily: false,
  },
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: colors.white,
      black: colors.black,
      gray: colors.gray,
      red: colors.red,
      yellow: colors.yellow,
      emerald: colors.emerald,
    },
  },
};
