import { env } from '@/env/frontend';
import { getAuthorisationURLWithQueryParamsAndSetState } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';

/**
 * utility for starting the login flow manually without clicking a button
 */
export const startAuthFlowForProvider = async (providerId: 'google' | 'okta' | 'github') => {
  const authUrl = await getAuthorisationURLWithQueryParamsAndSetState({
    providerId,
    authorisationURL: `${env.appBaseUrl}/auth/callback/${providerId}`,
  });

  window.location.assign(authUrl);
};

export const startAuthFlowForOIDCProvider = async (oidcId: string) => {
  const authUrl = await getAuthorisationURLWithQueryParamsAndSetState({
    providerId: 'oidc',
    authorisationURL: `${env.appBaseUrl}/auth/callback/oidc`,
    // The user context is very important - we store the OIDC ID so we can use it later on.
    userContext: {
      oidcId,
    },
  });

  window.location.assign(authUrl);
};
