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
  },
  SentryWebpackPluginOptions
);
