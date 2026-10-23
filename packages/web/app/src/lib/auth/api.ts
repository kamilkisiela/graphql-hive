import { env } from '@/env/frontend';
import { applyFrontTokenHeader } from './front-token';

/**
 * Typed client for the auth API the `server` service exposes under `/auth-api`. The routes keep the
 * SuperTokens FDI shapes (`formFields` arrays, `status` strings) because the server still serves them;
 * only the statuses a route can actually return are typed here.
 */

export class AuthApiError extends Error {
  override name = 'AuthApiError';
}

export type ThirdPartyProvider = 'github' | 'google' | 'okta' | 'oidc';

type FormField = { id: string; value: string };

export type SignInResult =
  | { status: 'OK' }
  | { status: 'WRONG_CREDENTIALS_ERROR' }
  | { status: 'SIGN_IN_NOT_ALLOWED'; reason: string };

export type SignUpResult =
  | { status: 'OK' }
  | { status: 'FIELD_ERROR'; formFields: Array<{ id: 'email' | 'password'; error: string }> }
  | { status: 'SIGN_UP_NOT_ALLOWED'; reason: string };

export type SendPasswordResetEmailResult = { status: 'OK' };

export type SubmitNewPasswordResult =
  | { status: 'OK' }
  | { status: 'FIELD_ERROR'; formFields: Array<{ id: string; error: string }> }
  | { status: 'RESET_PASSWORD_INVALID_TOKEN_ERROR' };

export type AuthorisationUrlResult = { status: 'OK'; urlWithQueryParams: string };

export type ThirdPartySignInUpResult =
  | { status: 'OK' }
  | { status: 'SIGN_IN_UP_NOT_ALLOWED'; reason: string };

export type OidcIdLookupResult =
  | { ok: true; id: string }
  | { ok: false; title: string; description: string; status: number };

type RequestInput = {
  method: 'GET' | 'POST';
  query?: Record<string, string>;
  body?: unknown;
};

function authApiUrl(path: string, query?: Record<string, string>): URL {
  const url = new URL(`/auth-api${path}`, env.graphqlPublicOrigin);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function authApiFetch(path: string, input: RequestInput): Promise<Response> {
  const hasBody = input.body !== undefined;
  const response = await fetch(authApiUrl(path, input.query), {
    method: input.method,
    credentials: 'include',
    // Fastify parses any request that declares a JSON content-type and rejects an empty body, so
    // the header goes only with a body.
    headers: hasBody ? { 'content-type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(input.body) : undefined,
  });
  applyFrontTokenHeader(response.headers.get('front-token'));
  return response;
}

async function authApiJson<TResult extends { status: string }>(
  path: string,
  input: RequestInput,
): Promise<TResult> {
  const response = await authApiFetch(path, input);
  if (!response.ok) {
    throw new AuthApiError(`Auth request failed with status ${response.status}.`);
  }
  const data: unknown = await response.json().catch(() => undefined);
  // A body-parse failure on the server answers 200 with the bare number 401.
  if (typeof data !== 'object' || data === null || typeof (data as any).status !== 'string') {
    throw new AuthApiError('Auth request returned an unexpected response.');
  }
  if ((data as any).status === 'GENERAL_ERROR') {
    throw new AuthApiError(
      typeof (data as any).message === 'string' ? (data as any).message : 'Something went wrong.',
    );
  }
  return data as TResult;
}

function formFields(fields: Record<string, string>): FormField[] {
  return Object.entries(fields).map(([id, value]) => ({ id, value }));
}

export function signIn(input: { email: string; password: string }): Promise<SignInResult> {
  return authApiJson<SignInResult>('/signin', {
    method: 'POST',
    body: { formFields: formFields(input) },
  });
}

export function signUp(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<SignUpResult> {
  return authApiJson<SignUpResult>('/signup', {
    method: 'POST',
    body: { formFields: formFields(input) },
  });
}

export async function signOut(): Promise<void> {
  await authApiJson<{ status: 'OK' }>('/signout', { method: 'POST' });
}

/**
 * Returns the HTTP status instead of throwing: 200 rotated the session (and the front token is
 * already applied), 404 means the session is gone, 401 means the refresh is rate limited.
 */
export async function refreshSession(): Promise<number> {
  const response = await authApiFetch('/session/refresh', { method: 'POST' });
  return response.status;
}

export function sendPasswordResetEmail(input: {
  email: string;
}): Promise<SendPasswordResetEmailResult> {
  return authApiJson<SendPasswordResetEmailResult>('/user/password/reset/token', {
    method: 'POST',
    body: { formFields: formFields(input) },
  });
}

export function submitNewPassword(input: {
  token: string;
  password: string;
}): Promise<SubmitNewPasswordResult> {
  return authApiJson<SubmitNewPasswordResult>('/user/password/reset', {
    method: 'POST',
    body: {
      method: 'token',
      token: input.token,
      formFields: formFields({ password: input.password }),
    },
  });
}

export function getAuthorisationUrl(input: {
  thirdPartyId: ThirdPartyProvider;
  redirectURIOnProviderDashboard: string;
  oidcId?: string;
}): Promise<AuthorisationUrlResult> {
  return authApiJson<AuthorisationUrlResult>('/authorisationurl', {
    method: 'GET',
    query: {
      thirdPartyId: input.thirdPartyId,
      redirectURIOnProviderDashboard: input.redirectURIOnProviderDashboard,
      ...(input.oidcId === undefined ? {} : { oidc_id: input.oidcId }),
    },
  });
}

export function thirdPartySignInUp(input: {
  thirdPartyId: ThirdPartyProvider;
  redirectURIOnProviderDashboard: string;
  redirectURIQueryParams: Record<string, string>;
}): Promise<ThirdPartySignInUpResult> {
  return authApiJson<ThirdPartySignInUpResult>('/signinup', {
    method: 'POST',
    body: {
      thirdPartyId: input.thirdPartyId,
      redirectURIInfo: {
        redirectURIOnProviderDashboard: input.redirectURIOnProviderDashboard,
        redirectURIQueryParams: input.redirectURIQueryParams,
      },
    },
  });
}

/** Resolves an organization slug to its OIDC integration id for the SSO sign-in page. */
export async function lookupOidcId(input: { slug: string }): Promise<OidcIdLookupResult> {
  const response = await authApiFetch('/oidc-id-lookup', {
    method: 'POST',
    body: { slug: input.slug },
  });
  if (response.status >= 500) {
    throw new AuthApiError('Server error');
  }
  const data: unknown = await response.json().catch(() => undefined);
  if (typeof data !== 'object' || data === null || typeof (data as any).ok !== 'boolean') {
    throw new AuthApiError('Auth request returned an unexpected response.');
  }
  return data as OidcIdLookupResult;
}
