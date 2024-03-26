import { env } from '@/env/frontend';

export const appInfo = () => {
  const { appBaseUrl, graphqlPublicOrigin } = env;

  return {
    // learn more about this on https://supertokens.com/docs/thirdpartyemailpassword/appinfo
    appName: 'GraphQL Hive',
    apiDomain: graphqlPublicOrigin,
    websiteDomain: appBaseUrl,
    apiBasePath: '/auth-api',
    websiteBasePath: '/auth',
  };
};
