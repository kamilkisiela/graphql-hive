/* eslint-disable no-process-env */

import { withGuildDocs } from '@theguild/components/next.config';

export default withGuildDocs({
  basePath: process.env.NEXT_BASE_PATH,
  eslint: {
    ignoreDuringBuilds: true,
  },
  redirects: async () => [
    {
      source: '/docs/get-started/organizations',
      destination: '/docs/management/organizations',
      permanent: true,
    },
    {
      source: '/docs/get-started/projects',
      destination: '/docs/management/projects',
      permanent: true,
    },
    {
      source: '/docs/get-started/targets',
      destination: '/docs/management/targets',
      permanent: true,
    },
    {
      source: '/docs/features/tokens',
      destination: '/docs/management/targets#manage-tokens',
      permanent: true,
    },
    {
      source: '/docs/features/publish-schema',
      destination: '/docs/features/schema-registry#publish-a-schema',
      permanent: true,
    },
    {
      source: '/docs/features/checking-schema',
      destination: '/docs/features/schema-registry#check-a-schema',
      permanent: true,
    },
    {
      source: '/docs/features/delete-schema',
      destination: '/docs/features/schema-registry#delete-a-service',
      permanent: true,
    },
    {
      source: '/docs/features/registry-usage',
      destination: '/docs/features/high-availability-cdn',
      permanent: true,
    },
    {
      source: '/docs/features/monitoring',
      destination: '/docs/features/usage-reporting',
      permanent: true,
    },
    {
      source: '/docs/features/schema-history',
      destination: '/docs/features/schema-registry#schema-history-and-changelog',
      permanent: true,
    },
    {
      source: '/docs/features/integrations',
      destination: '/docs/management/organizations#integrations',
      permanent: true,
    },
    {
      source: '/docs/features/alerts-notifications',
      destination: '/docs/management/projects#alerts-and-notifications',
      permanent: true,
    },
    {
      source: '/docs/features/external-schema-composition',
      destination: '/docs/management/external-schema-composition',
      permanent: true,
    },
    {
      source: '/docs/specs/schema-reports',
      destination: '/docs/api-reference/cli#publish-a-schema',
      permanent: true,
    },
  ],
  swcMinify: true,
  webpack: (config, { webpack }) => {
    config.externals['node:fs'] = 'commonjs node:fs';
    config.externals['node:path'] = 'commonjs node:path';

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, resource => {
        resource.request = resource.request.replace(/^node:/, '');
      }),
    );

    return config;
  },
});
