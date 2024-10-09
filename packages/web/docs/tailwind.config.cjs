// @ts-check
/**
 * @type {typeof import("@theguild/tailwind-config").default}
 */
const config = /** @type {any} */ (require('@theguild/tailwind-config'));
const plugin = require('tailwindcss/plugin');
const { fontFamily } = require('tailwindcss/defaultTheme');
const { default: flattenColorPalette } = require('tailwindcss/lib/util/flattenColorPalette');

/**
 * @type {import("tailwindcss").Config}
 */
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
        ...config.theme.extend.colors,
        primary: config.theme.extend.colors['hive-yellow'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: 0, opacity: 0 },
          to: { height: 'var(--radix-accordion-content-height)', opacity: 1 },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)', opacity: 1 },
          to: { height: 0, opacity: 0 },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.5s ease',
        'accordion-up': 'accordion-up 0.5s ease',
      },
    },
  },
  plugins: [
    require('tailwindcss-radix')({ variantPrefix: 'rdx' }),
    require('tailwindcss-animate'),
    plugin(({ addUtilities, matchUtilities, theme }) => {
      addUtilities({
        '.mask-image-none': {
          'mask-image': 'none',
        },
      });
      matchUtilities(
        {
          blockquote: color => ({
            position: 'relative',
            quotes: '"“" "”" "‘" "’"',
            '&:before, &:after': {
              lineHeight: '0',
              position: 'relative',
              fontSize: '2.25em',
              display: 'inline-block',
              verticalAlign: 'middle',
              width: '0',
              color,
            },
            '&:before': {
              content: 'open-quote',
              left: '-0.375em',
            },
            '&:after': {
              content: 'close-quote',
            },
          }),
        },
        {
          values: flattenColorPalette(theme('colors')),
          type: 'color',
        },
      );
    }),
  ],
  darkMode: ['variant', '&:not(.light *)'],
};
