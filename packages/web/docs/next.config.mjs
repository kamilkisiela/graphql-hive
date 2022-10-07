import nextra from 'nextra';

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.mjs',
  unstable_staticImage: true,
});

export default withNextra({
  output: 'standalone',
  swcMinify: true,
  compiler: {
    styledComponents: true,
  },
});
