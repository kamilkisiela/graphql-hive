import Cookies from 'js-cookie';
import { z } from 'zod';

/**
 * The session as the browser can see it. The access and refresh tokens are httpOnly cookies on the
 * API origin, so the only client-readable view is the `front-token` header the auth API returns on
 * every login and refresh: base64 JSON of `{ uid, ate, up }`. We keep it in the same `sFrontToken`
 * cookie the SuperTokens SDK used, so sessions created before this client shipped stay signed in.
 */
export type Session = {
  /** The SuperTokens user id (`uid`), which the email-verification mutations call `userIdentityId`. */
  userId: string;
  /** Missing on tokens issued before the auth payload carried an email. */
  email: string | undefined;
  oidcIntegrationId: string | null;
  /** Epoch milliseconds; after this the access token is expired and a refresh is needed. */
  accessTokenExpiresAt: number;
};

export type FrontTokenSnapshot =
  | { status: 'absent' }
  | { status: 'invalid'; raw: string }
  | { status: 'valid'; raw: string; session: Session };

const FRONT_TOKEN_COOKIE = 'sFrontToken';
// The SDK's "session exists" marker. Old-SDK tabs still open during the rollout read it before and
// after their own refresh to detect that another tab refreshed; without it they replay a consumed
// refresh token and the server deletes the session. Dropping it is a follow-up.
const LAST_UPDATE_COOKIE = 'st-last-access-token-update';
// Only ever cleared by the SDK; kept here so sign-out leaves nothing of it behind.
const LEGACY_SESSION_MARKER_COOKIE = 'sIRTFrontend';

// Tokens issued before the at-home auth migration carry a v1 payload without `email`, and the SDK
// wrote the cookie with a far-future expiry, so a lenient shape keeps them readable (and refreshable).
const FrontTokenModel = z.object({
  uid: z.string(),
  ate: z.number(),
  up: z.object({
    email: z.string().optional(),
    oidcIntegrationId: z.string().nullable().optional(),
  }),
});

function cookieAttributes(): Cookies.CookieAttributes {
  return {
    path: '/',
    sameSite: 'lax',
    secure: window.location.protocol === 'https:',
    expires: 400,
  };
}

function decodeBase64Json(raw: string): unknown {
  const bytes = Uint8Array.from(atob(raw), char => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function parse(raw: string | undefined): FrontTokenSnapshot {
  if (raw === undefined || raw === '') {
    return { status: 'absent' };
  }
  try {
    const token = FrontTokenModel.parse(decodeBase64Json(raw));
    return {
      status: 'valid',
      raw,
      session: {
        userId: token.uid,
        email: token.up.email,
        oidcIntegrationId: token.up.oidcIntegrationId ?? null,
        accessTokenExpiresAt: token.ate,
      },
    };
  } catch {
    return { status: 'invalid', raw };
  }
}

let cached: { raw: string | undefined; snapshot: FrontTokenSnapshot } | null = null;
const listeners = new Set<() => void>();

/** Stable per cookie value, as `useSyncExternalStore` requires. */
export function getSnapshot(): FrontTokenSnapshot {
  const raw = Cookies.get(FRONT_TOKEN_COOKIE);
  if (cached === null || cached.raw !== raw) {
    cached = { raw, snapshot: parse(raw) };
  }
  return cached.snapshot;
}

export function getSession(): Session | null {
  const snapshot = getSnapshot();
  return snapshot.status === 'valid' ? snapshot.session : null;
}

/**
 * Notified after this tab writes or clears the token. Cookies emit no change events, so another
 * tab's write only shows up on the next `getSnapshot()` read.
 */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/** Applies the `front-token` header of an auth API response; `null` means the response had none. */
export function applyFrontTokenHeader(header: string | null): void {
  if (header === null) {
    return;
  }
  if (header === 'remove') {
    clearFrontToken();
    return;
  }
  Cookies.set(FRONT_TOKEN_COOKIE, header, cookieAttributes());
  Cookies.set(LAST_UPDATE_COOKIE, Date.now().toString(), cookieAttributes());
  notify();
}

export function clearFrontToken(): void {
  Cookies.remove(FRONT_TOKEN_COOKIE, { path: '/' });
  Cookies.remove(LAST_UPDATE_COOKIE, { path: '/' });
  Cookies.remove(LEGACY_SESSION_MARKER_COOKIE, { path: '/' });
  notify();
}
