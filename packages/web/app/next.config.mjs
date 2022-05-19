import fs from 'node:fs';
import { withSentryConfig } from '@sentry/nextjs';

const packageJson = JSON.parse(fs.readFileSync('./package.json'));

/**
 * @type {import('@sentry/webpack-plugin').SentryCliPluginOptions}
 */
const SentryWebpackPluginOptions = {
  silent: true,
  release: packageJson.version,
};

export default withSentryConfig(
  {
    eslint: {
      ignoreDuringBuilds: true,
    },
    sentry: {
      disableServerWebpackPlugin: true,
      disableClientWebpackPlugin: true,
    },
    redirects: () => [
      // Redirect organization routes
      {
        source: '/:orgId/subscription/manage',
        destination: '/:orgId/subscription',
        permanent: true,
      },
    ],
  },
  SentryWebpackPluginOptions
);
