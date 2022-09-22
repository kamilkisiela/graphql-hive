import fs from 'node:fs';
import { withSentryConfig } from '@sentry/nextjs';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

/**
 * @type {import('@sentry/webpack-plugin').SentryCliPluginOptions}
 */
const SentryWebpackPluginOptions = {
  silent: true,
  release: packageJson.version,
};

if (process.env.BUILD !== '1') {
  await import('./environment');
}

export default withSentryConfig(
  {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
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
