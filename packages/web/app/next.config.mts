import bundleAnalyzer from '@next/bundle-analyzer';

// For the dev server we want to make sure that the correct environment variables are set :)
// during build we don't need environment variables!
if (globalThis.process.env.BUILD !== '1') {
  await import('./environment');
}

const withBundleAnalyzer = bundleAnalyzer({
  enabled: globalThis.process.env.ANALYZE === '1',
  openAnalyzer: true,
});

export default withBundleAnalyzer({
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // next doesn't need to check because typecheck command will
    // also Next.js report false positives (try it...)
    ignoreBuildErrors: true,
  },
  redirects: async () => [
    // Redirect organization routes
    {
      source: '/:orgId/view/subscription/manage',
      destination: '/:orgId/view/subscription',
      permanent: true,
    },
  ],
  swcMinify: true,
});
