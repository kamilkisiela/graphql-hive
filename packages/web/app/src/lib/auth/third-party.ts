import { env } from '@/env/frontend';
import { isSafeRedirectPath } from '@/lib/route-utils';
import {
  getAuthorisationUrl,
  thirdPartySignInUp,
  type ThirdPartyProvider,
  type ThirdPartySignInUpResult,
} from './api';
import { updateLastAuthMethod } from './last-auth-method';

// The flow this browser started: the server's `state` and where to go afterwards. The round trip
// leaves the app, so it lives in sessionStorage; a callback opened in another tab has no flow.
const FLOW_KEY = 'hive:auth-flow';

type PendingFlow = { state: string | null; redirectToPath: string };

function assertProviderEnabled(provider: ThirdPartyProvider) {
  if (!env.auth[provider]) {
    throw new Error(`Provider for ${provider} is not configured`);
  }
}

/** The server registers this exact URL with the provider, so the two must agree character for character. */
function callbackUrl(provider: ThirdPartyProvider): string {
  return new URL(`/auth/callback/${provider}`, env.appBaseUrl).href;
}

function stashFlow(flow: PendingFlow) {
  try {
    sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow));
  } catch {
    // Storage can be unavailable; the callback is then refused and the user starts over.
  }
}

function takeFlow(): PendingFlow | null {
  try {
    const raw = sessionStorage.getItem(FLOW_KEY);
    sessionStorage.removeItem(FLOW_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const { state, redirectToPath } = parsed as Record<string, unknown>;
    return {
      state: typeof state === 'string' ? state : null,
      redirectToPath:
        typeof redirectToPath === 'string' && isSafeRedirectPath(redirectToPath)
          ? redirectToPath
          : '/',
    };
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
  stashFlow({
    state: new URL(result.urlWithQueryParams).searchParams.get('state'),
    redirectToPath: redirectToPath ?? '/',
  });
  updateLastAuthMethod(provider);
  window.location.assign(result.urlWithQueryParams);
}

export type ThirdPartyAuthCompletion =
  | { status: 'OK'; redirectToPath: string }
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
  const flow = takeFlow();
  const providerError = params['error'];
  if (providerError !== undefined) {
    // Reported before calling the server: the server's state record is single-use. The text is
    // the provider's (or anyone's who crafted the link), so it is logged rather than shown.
    console.error('Sign-in provider error', providerError, params['error_description']);
    throw new Error('The sign-in provider reported an error. Please try again.');
  }
  // The callback must answer the sign-in this browser asked for. Without this check a link
  // carrying someone else's code and state would sign this browser into their account.
  const notStartedHere = new Error(
    'This sign-in was not started from this browser. Please try again.',
  );
  if (flow === null) {
    throw notStartedHere;
  }
  if (flow.state === null || params['state'] !== flow.state) {
    throw notStartedHere;
  }
  const result = await thirdPartySignInUp({
    thirdPartyId: provider,
    redirectURIOnProviderDashboard: callbackUrl(provider),
    redirectURIQueryParams: params,
  });
  if (result.status !== 'OK') {
    return result;
  }
  return { status: 'OK', redirectToPath: flow.redirectToPath };
}
