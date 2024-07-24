import { getAuthorisationURLWithQueryParamsAndSetState } from 'supertokens-auth-react/recipe/thirdpartyemailpassword';
import { env } from '@/env/frontend';
import { updateLastAuthMethod } from './last-auth-method';

/**
 * utility for starting the login flow manually without clicking a button
 */
export const startAuthFlowForProvider = async (
  thirdPartyId: 'google' | 'okta' | 'github',
  redirectToPath?: string,
) => {
  if (!env.auth[thirdPartyId]) {
    throw new Error(`Provider for ${thirdPartyId} is not configured`);
  }

  const providersWithRedirectPartSupport = ['github'];

  // Google does not support ?redirectToPath= query param.
  // It gives back an error saying that the redirect_uri is not allowed.
  const redirectPart =
    redirectToPath && providersWithRedirectPartSupport.includes(thirdPartyId)
      ? `?redirectToPath=${encodeURIComponent(redirectToPath)}`
      : '';
  const authUrl = await getAuthorisationURLWithQueryParamsAndSetState({
    thirdPartyId,
    frontendRedirectURI: `${env.appBaseUrl}/auth/callback/${thirdPartyId}${redirectPart}`,
  });

  updateLastAuthMethod(thirdPartyId);

  window.location.assign(authUrl);
};
