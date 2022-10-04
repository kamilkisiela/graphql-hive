import { env } from '@/env/frontend';

export const appInfo = () => {
  const appBaseUrl = env.appBaseUrl;

  return {
    // learn more about this on https://supertokens.com/docs/thirdpartyemailpassword/appinfo
    appName: 'GraphQL Hive',
    apiDomain: appBaseUrl,
    websiteDomain: appBaseUrl,
    apiBasePath: '/api/auth',
    websiteBasePath: '/auth',
  };
};
