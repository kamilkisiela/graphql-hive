import { env } from '@/env/frontend';
import { isSafeRedirectPath } from '@/lib/route-utils';
import {
  getAuthorisationUrl,
  thirdPartySignInUp,
  type ThirdPartyProvider,
  type ThirdPartySignInUpResult,
} from './api';
import { updateLastAuthMethod } from './last-auth-method';

// Where to go after the provider sends the user back. The round trip leaves the app, so it lives
// in sessionStorage for the duration; a callback opened in another tab starts from `/`.
const REDIRECT_PATH_KEY = 'hive:auth-redirect';

function assertProviderEnabled(provider: ThirdPartyProvider) {
  if (!env.auth[provider]) {
    throw new Error(`Provider for ${provider} is not configured`);
  }
}

/** The server registers this exact URL with the provider, so the two must agree character for character. */
function callbackUrl(provider: ThirdPartyProvider): string {
  return new URL(`/auth/callback/${provider}`, env.appBaseUrl).href;
}

function stashRedirectPath(redirectToPath: string | undefined) {
  try {
    sessionStorage.setItem(REDIRECT_PATH_KEY, redirectToPath ?? '/');
  } catch {
    // Storage can be unavailable; the callback then falls back to the route default.
  }
}

function takeRedirectPath(): string | null {
  try {
    const value = sessionStorage.getItem(REDIRECT_PATH_KEY);
    sessionStorage.removeItem(REDIRECT_PATH_KEY);
    return value !== null && isSafeRedirectPath(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Sends the browser to the provider's sign-in page. The server builds the URL, including the
 * `state` it later checks, so it is used untouched.
 */
export async function startThirdPartyAuth(
  provider: ThirdPartyProvider,
  redirectToPath?: string,
  oidcId?: string,
): Promise<void> {
  assertProviderEnabled(provider);
  const result = await getAuthorisationUrl({
    thirdPartyId: provider,
    redirectURIOnProviderDashboard: callbackUrl(provider),
    oidcId,
  });
  stashRedirectPath(redirectToPath);
  updateLastAuthMethod(provider);
  window.location.assign(result.urlWithQueryParams);
}

export type ThirdPartyAuthCompletion =
  | { status: 'OK'; redirectToPath: string | null }
  | Exclude<ThirdPartySignInUpResult, { status: 'OK' }>;

/**
 * Finishes the sign-in on the callback page by handing every query parameter the provider sent
 * to the server. The parameters are read from the URL itself: the route's search schema would
 * drop `code` and `state`, and the router parses JSON-looking values.
 */
export async function completeThirdPartyAuth(
  provider: ThirdPartyProvider,
): Promise<ThirdPartyAuthCompletion> {
  assertProviderEnabled(provider);
  const params = Object.fromEntries(new URLSearchParams(window.location.search));
  const providerError = params['error'];
  if (providerError !== undefined) {
    // Reported before calling the server: the server's state record is single-use.
    throw new Error(params['error_description'] ?? providerError);
  }
  const result = await thirdPartySignInUp({
    thirdPartyId: provider,
    redirectURIOnProviderDashboard: callbackUrl(provider),
    redirectURIQueryParams: params,
  });
  if (result.status !== 'OK') {
    return result;
  }
  return { status: 'OK', redirectToPath: takeRedirectPath() };
}
