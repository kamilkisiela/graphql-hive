import { getAuthorisationURLWithQueryParamsAndSetState } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import { env } from '@/env/frontend';

/**
 * utility for starting the login flow manually without clicking a button
 */
export const startAuthFlowForProvider = async (thirdPartyId: 'google' | 'okta' | 'github') => {
  const authUrl = await getAuthorisationURLWithQueryParamsAndSetState({
    thirdPartyId,
    frontendRedirectURI: `${env.appBaseUrl}/auth/callback/${thirdPartyId}`,
  });

  window.location.assign(authUrl);
};
