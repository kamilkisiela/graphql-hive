/* eslint-disable no-process-env */

import fs from 'fs';
import path from 'path';
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
  ],
  swcMinify: true,
  transformPageOpts(pageOpts) {
    const changelogItems = pageOpts.pageMap.find(item => item.name === 'changelog').children;

    fs.writeFileSync(
      path.join('.', 'public', 'changelog.json'),
      JSON.stringify(
        changelogItems
          .filter(
            item =>
              item.kind === 'MdxPage' &&
              item.frontMatter.title &&
              item.frontMatter.description &&
              item.frontMatter.date,
          )
          .map(item => ({
            route: item.route,
            title: item.frontMatter.title,
            description: item.frontMatter.description,
            date: item.frontMatter.date,
          })),
        null,
        2,
      ),
    );

    return pageOpts;
  },
});
