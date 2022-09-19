function throwException(msg: string) {
  throw new Error(msg);
}

const appBaseUrl =
  globalThis.process?.env?.['APP_BASE_URL'] ??
  globalThis?.['__ENV__']?.['APP_BASE_URL'] ??
  throwException('APP_BASE_URL is not defined');

export const appInfo = {
  // learn more about this on https://supertokens.com/docs/thirdpartyemailpassword/appinfo
  appName: 'GraphQL Hive',
  apiDomain: appBaseUrl,
  websiteDomain: appBaseUrl,
  apiBasePath: '/api/auth',
  websiteBasePath: '/auth',
};
