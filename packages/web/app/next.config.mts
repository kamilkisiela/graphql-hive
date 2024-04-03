import type { NextConfig } from 'next';
import './environment';

export default {
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
} satisfies NextConfig;
