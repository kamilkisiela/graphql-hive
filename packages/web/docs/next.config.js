import { withGuildDocs } from '@theguild/components/next.config';

export default withGuildDocs({
  nextraConfig: /** @satisfies import("nextra").NextraConfig*/ ({
    themeConfig: './src/theme.config.tsx',
    autoImportThemeStyle: false,
  }),
  output: 'export',
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
      destination: '/docs/schema-registry#publish-a-schema',
      permanent: true,
    },
    {
      source: '/docs/features/checking-schema',
      destination: '/docs/schema-registry#check-a-schema',
      permanent: true,
    },
    {
      source: '/docs/features/delete-schema',
      destination: '/docs/schema-registry#delete-a-service',
      permanent: true,
    },
    {
      source: '/docs/features/registry-usage',
      destination: '/docs/high-availability-cdn',
      permanent: true,
    },
    {
      source: '/docs/features/high-availability-cdn',
      destination: '/docs/high-availability-cdn',
      permanent: true,
    },
    {
      source: '/docs/features/monitoring',
      destination: '/docs/schema-registry/usage-reporting',
      permanent: true,
    },
    {
      source: '/docs/features/usage-reporting',
      destination: '/docs/schema-registry/usage-reporting',
      permanent: true,
    },
    {
      source: '/docs/features/schema-history',
      destination: '/docs/schema-registry#schema-history-and-changelog',
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
      source: '/docs/management/external-schema-composition',
      destination: '/docs/schema-registry/external-schema-composition',
      permanent: true,
    },
    {
      source: '/docs/features/external-schema-composition',
      destination: '/docs/schema-registry/external-schema-composition',
      permanent: true,
    },
    {
      source: '/docs/specs/schema-reports',
      destination: '/docs/api-reference/cli#publish-a-schema',
      permanent: true,
    },
    {
      source: '/docs/self-hosting/apollo-federation-2',
      destination: '/docs/self-hosting/external-composition',
      permanent: true,
    },
    {
      source: '/docs/features/sso-oidc-provider',
      destination: '/docs/management/sso-oidc-provider',
      permanent: true,
    },
    {
      source: '/docs/features/schema-registry',
      destination: '/docs/schema-registry',
      permanent: true,
    },
    {
      source: '/docs/management/external-schema-composition',
      destination: '/docs/schema-registry/external-schema-composition',
      permanent: true,
    },
    {
      source: '/docs/features/laboratory',
      destination: '/docs/dashboard/laboratory',
      permanent: true,
    },
    {
      source: '/docs/management/contracts',
      destination: '/docs/schema-registry/contracts',
      permanent: true,
    },
    {
      source: '/docs/features/schema-policy',
      destination: '/docs/schema-registry/schema-policy',
      permanent: true,
    },
    {
      source: '/docs/features/app-deployments',
      destination: '/docs/schema-registry/app-deployments',
      permanent: true,
    },
    {
      // SEO: Redirect to the new URL
      source: '/docs/self-hosting/federation-2',
      destination: '/docs/self-hosting/external-composition',
      permanent: true,
    },
    {
      source: '/docs/integrations/:path*',
      destination: '/docs/other-integrations/:path*',
      permanent: false,
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
