const baseUrl = globalThis['__ENV__']?.['APP_BASE_URL'] ?? process.env['APP_BASE_URL'];

export const appInfo = {
  // learn more about this on https://supertokens.com/docs/thirdpartyemailpassword/appinfo
  appName: 'GraphQL Hive',
  apiDomain: baseUrl,
  websiteDomain: baseUrl,
  apiBasePath: '/api/auth',
  websiteBasePath: '/auth',
};
