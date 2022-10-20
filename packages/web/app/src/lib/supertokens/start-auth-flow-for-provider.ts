import { env } from '@/env/frontend';
import { getAuthorisationURLWithQueryParamsAndSetState } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';

/**
 * utility for starting the login flow manually without clicking a button
 */
export const startAuthFlowForProvider = async (providerId: 'google' | 'okta' | 'github') => {
  const authUrl = await getAuthorisationURLWithQueryParamsAndSetState({
    providerId,
    authorisationURL: `${env.appBaseUrl.replace(/\/$/, '')}/auth/callback/${providerId}`,
  });

  window.location.assign(authUrl);
};
