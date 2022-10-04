// For the dev server we want to make sure that the correct environment variables are set :)
// during build we don't need environment variables!
if (globalThis.process.env.BUILD !== '1') {
  await import('./environment');
}

export default {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  eslint: {
    ignoreDuringBuilds: true,
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
