module.exports = {
  trailingComma: 'es5',
  semi: true,
  singleQuote: true,
  overrides: [
    {
      files: '*.{md,mdx}',
      options: {
        semi: false,
        trailingComma: 'none',
      },
    },
  ],
  plugins: [require('prettier-plugin-tailwindcss')],
};
