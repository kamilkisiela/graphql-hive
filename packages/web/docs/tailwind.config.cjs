const config = require('@theguild/tailwind-config');
const plugin = require('tailwindcss/plugin');
const { fontFamily } = require('tailwindcss/defaultTheme');

console.log('loaded tailwind config', __filename);

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
      colors: {
        primary: '#E1FF00',
        blue: {
          100: '#F4F5F5',
          200: '#DCE3E4',
          300: '#C1D3D7',
          400: '#A4C4CB',
          500: '#86B6C1',
          600: '#68A8B6',
          700: '#4F96A6',
          800: '#437C89',
          900: '#39616A',
          1000: '#2E474C',
        },
        green: {
          100: '#ECF6F3',
          200: '#CAE4DE',
          300: '#A7D5CA',
          400: '#8CBEB3',
          500: '#6AAC9E',
          600: '#55998D',
          700: '#3B736A',
          800: '#245850',
          900: '#15433C',
          1000: '#00342C',
        },
        beige: {
          100: '#F8F7F6',
          200: '#F1EEE4',
          300: '#E9E5DA',
          400: '#DEDACF',
          500: '#CFCABF',
          600: '#B9B4A9',
          700: '#A29E93',
          800: '#86827A',
          900: '#6D6A63',
          1000: '#4D4B46',
        },
      },
    },
  },
  plugins: [
    require('tailwindcss-radix')({ variantPrefix: 'rdx' }),
    plugin(({ addUtilities }) => {
      addUtilities({
        '.mask-image-none': {
          'mask-image': 'none',
        },
      });
    }),
  ],
};
