/* eslint-disable no-process-env */
import { withGuildDocs } from '@theguild/components/next.config';

export default withGuildDocs({
  basePath: process.env.NEXT_BASE_PATH,
  eslint: {
    ignoreDuringBuilds: true,
  },
  redirects: async () => [
    {
      source: '/get-started/organizations',
      destination: '/management/organizations',
      permanent: true,
    },
    {
      source: '/get-started/projects',
      destination: '/management/projects',
      permanent: true,
    },
    {
      source: '/get-started/targets',
      destination: '/management/targets',
      permanent: true,
    },
    {
      source: '/features/tokens',
      destination: '/management/targets#manage-tokens',
      permanent: true,
    },
    {
      source: '/features/publish-schema',
      destination: '/features/schema-registry#publish-a-schema',
      permanent: true,
    },
    {
      source: '/features/checking-schema',
      destination: '/features/schema-registry#check-a-schema',
      permanent: true,
    },
    {
      source: '/features/delete-schema',
      destination: '/features/schema-registry#delete-a-service',
      permanent: true,
    },
    {
      source: '/features/registry-usage',
      destination: '/features/high-availability-cdn',
      permanent: true,
    },
    {
      source: '/features/monitoring',
      destination: '/features/usage-reporting',
      permanent: true,
    },
    {
      source: '/features/schema-history',
      destination: '/features/schema-registry#schema-history-and-changelog',
      permanent: true,
    },
    {
      source: '/features/integrations',
      destination: '/management/organizations#integrations',
      permanent: true,
    },
    {
      source: '/features/alerts-notifications',
      destination: '/management/projects#alerts-and-notifications',
      permanent: true,
    },
    {
      source: '/features/external-schema-composition',
      destination: '/management/external-schema-composition',
      permanent: true,
    },
  ],
});
