import bundleAnalyzer from '@next/bundle-analyzer';
import './environment';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: globalThis.process.env.ANALYZE === '1',
  openAnalyzer: true,
});

export default withBundleAnalyzer({
  productionBrowserSourceMaps: true,
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
      source: '/:organizationId/view/subscription/manage',
      destination: '/:organizationId/view/subscription',
      permanent: true,
    },
  ],
});
