import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

// For the dev server we want to make sure that the correct environment variables are set :)
// during build we don't need environment variables!
if (process.env.BUILD !== '1') {
  await import('./environment');
}

export default {
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
};
