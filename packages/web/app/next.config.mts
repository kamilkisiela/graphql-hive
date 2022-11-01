// For the dev server we want to make sure that the correct environment variables are set :)
// during build we don't need environment variables!
if (globalThis.process.env.BUILD !== '1') {
  await import('./environment');
}

export default {
  poweredByHeader: false,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // next doesn't need to check because typecheck command will
    // also next reports false positives (try it...)
    ignoreBuildErrors: true,
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
