const { withSentryConfig } = require('@sentry/nextjs');
const { version } = require('./package.json');

/**
 * @type {import('@sentry/webpack-plugin').SentryCliPluginOptions}
 */
const SentryWebpackPluginOptions = {
  silent: true,
  release: version,
};

module.exports = withSentryConfig(
  {
    eslint: {
      ignoreDuringBuilds: true,
    },
    sentry: {
      disableServerWebpackPlugin: true,
      disableClientWebpackPlugin: true,
    },
    // redirects: () => [
    //   // Redirect v1 targets routes
    //   {
    //     source: '/:orgId/:projectId/:targetId/history',
    //     destination: '/:orgId/:projectId/:targetId#history',
    //     permanent: true,
    //   },
    //   {
    //     source: '/:orgId/:projectId/:targetId/(lab|laboratory)',
    //     destination: '/:orgId/:projectId/:targetId#laboratory',
    //     permanent: true,
    //   },
    //   {
    //     source: '/:orgId/:projectId/:targetId/operations',
    //     destination: '/:orgId/:projectId/:targetId#operations',
    //     permanent: true,
    //   },
    //   {
    //     source: '/:orgId/:projectId/:targetId/schema',
    //     destination: '/:orgId/:projectId/:targetId',
    //     permanent: true,
    //   },
    //   {
    //     source: '/:orgId/:projectId/:targetId/settings',
    //     destination: '/:orgId/:projectId/:targetId#settings',
    //     permanent: true,
    //   },
    //   // Redirect v1 project routes
    //   {
    //     source: '/:orgId/:projectId/alerts',
    //     destination: '/:orgId/:projectId#alerts',
    //     permanent: true,
    //   },
    //   {
    //     source: '/:orgId/:projectId/operations-store',
    //     destination: '/:orgId/:projectId#operations-store',
    //     permanent: true,
    //   },
    //   {
    //     source: '/:orgId/:projectId/settings',
    //     destination: '/:orgId/:projectId#settings',
    //     permanent: true,
    //   },
    //   {
    //     source: '/:orgId/:projectId/targets',
    //     destination: '/:orgId/:projectId',
    //     permanent: true,
    //   },
    //   // Redirect v1 org routes
    //   {
    //     source: '/:orgId/subscription/manage',
    //     destination: '/:orgId/subscription',
    //     permanent: true,
    //   },
    // ],
  },
  SentryWebpackPluginOptions
);
