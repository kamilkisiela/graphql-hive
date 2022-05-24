const colors = require('tailwindcss/colors');
const plugin = require('tailwindcss/plugin');

module.exports = {
  darkMode: 'class',
  mode: 'jit', // remove in v3
  purge: ['./{pages,src}/**/*.ts{,x}'], // rename to content in v3
  theme: {
    fontFamily: {
      // to use `font-sans` class
      sans: ['Inter', 'ui-sans-serif', 'system-ui'],
    },
    container: {
      center: true,
    },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#fcfcfc',
      black: '#0b0d11',
      // gray: colors.gray,
      // red: colors.red,
      // yellow: colors.yellow,
      emerald: colors.emerald,

      red: {
        50: '#fef5f5',
        100: '#fdeaeb',
        200: '#fbcbce',
        300: '#f8abb0',
        400: '#f26d74',
        500: '#ed2e39',
        600: '#d52933',
        700: '#b2232b',
        800: '#8e1c22',
        900: '#74171c',
      },
      yellow: {
        50: '#fffcf2',
        100: '#fffae6',
        200: '#fff2bf',
        300: '#ffeb99',
        400: '#ffdb4d',
        500: '#fc0',
        600: '#e6b800',
        700: '#bf9900',
        800: '#997a00',
        900: '#7d6400',
      },
      green: {
        50: '#f2fcf9',
        100: '#e6f8f3',
        200: '#bfeee1',
        300: '#99e3cf',
        400: '#4dcfac',
        500: '#00ba88',
        600: '#00a77a',
        700: '#008c66',
        800: '#007052',
        900: '#005b43',
      },
      cyan: '#0acccc',
      purple: '#5f2eea',
      blue: '#0078ee',
      gray: {
        100: '#f2f2f4',
        200: '#dfe0e2',
        300: '#cccdd1',
        400: '#a5a7af',
        500: '#7f818c',
        600: '#72747e',
        700: '#5f6169',
        800: '#24272e', // '#4c4d54',
        900: '#202329',
      },
      magenta: '#f11197',
      orange: {
        50: '#fefbf5',
        100: '#fef8ec',
        200: '#fcedcf',
        300: '#fbe2b3',
        400: '#f7cd79',
        500: '#f4b740',
        600: '#dca53a',
        700: '#b78930',
        800: '#926e26',
        900: '#785a1f',
      },
    },
    extend: {
      zIndex: {
        '-1': -1,
      },
      ringColor: theme => ({
        DEFAULT: theme('colors.orange.500'),
        ...theme('colors'),
      }),
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        '.drag-none': {
          '-webkit-user-drag': 'none',
        },
        '.fill-none': {
          fill: 'none',
        },
        '.will-change-transform': {
          willChange: 'transform', // exist in tailwind v3, remove after upgrade
        },
        '.grow': {
          flexGrow: 1, // exist in v3
        },
        '.grow-0': {
          flexGrow: 0, // exist in v3
        },
        '.shrink-0': {
          flexShrink: 0, // exist in v3
        },
        '.text-ellipsis': {
          textOverflow: 'ellipsis', // exist in v3
        },
      });
    }),
    // Utilities for visually truncating text after a fixed number of lines
    require('@tailwindcss/line-clamp'),
    // Utilities and variants for styling Radix state
    require('tailwindcss-radix')(),
  ],
};
