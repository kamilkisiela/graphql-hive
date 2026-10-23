import { refreshSession, signOut as signOutRequest } from './api';
import { clearFrontToken, getSnapshot, type FrontTokenSnapshot } from './front-token';

// Everything the app reads about the session goes through this module (not `front-token.ts`), so
// specs can replace it with the single stand-in in `lib/testing/mocks/auth-session.ts`.
export { getSession, getSnapshot, subscribe } from './front-token';
export type { FrontTokenSnapshot, Session } from './front-token';

/**
 * A token the API will still accept. We compare the server's expiry to the client clock; the SDK
 * corrected for clock skew and we do not. A fast clock refreshes on every navigation (harmless, the
 * refresh is lock-protected), a slow one lets an expired token through to GraphQL, whose
 * NEEDS_REFRESH answer then triggers the same refresh.
 */
export function isUsable(snapshot: FrontTokenSnapshot, now = Date.now()): boolean {
  return snapshot.status === 'valid' && snapshot.session.accessTokenExpiresAt > now;
}

const REFRESH_LOCK = 'hive:session-refresh';

function withCrossTabLock<T>(callback: () => Promise<T>): Promise<T> {
  // `lib.dom` types `navigator.locks` as always present; jsdom and Safari before 15.4 lack it.
  // The SDK used a localStorage lock that worked everywhere; without Web Locks two tabs
  // refreshing at the same moment can both be signed out once.
  const locks = (navigator as { locks?: LockManager }).locks;
  return locks ? (locks.request(REFRESH_LOCK, callback) as Promise<T>) : callback();
}

async function refreshUnderLock(before: FrontTokenSnapshot): Promise<boolean> {
  // Re-read after waiting for the lock: another tab may have finished with the same token, or
  // signed out. A token that was never there says nothing about the API cookies, so that case
  // still asks the server (the caller was just told NEEDS_REFRESH).
  const current = getSnapshot();
  if (current.status === 'absent' && before.status !== 'absent') {
    return false;
  }
  if (current !== before && isUsable(current)) {
    return true;
  }
  const status = await refreshSession();
  if (status === 200) {
    return true;
  }
  if (status === 404) {
    clearFrontToken();
    return false;
  }
  throw new Error(`Session refresh failed with status ${status}.`);
}

let inFlight: Promise<boolean> | null = null;

/**
 * Rotates the session through `POST /auth-api/session/refresh`, at most once at a time per tab
 * and per browser. Resolves `true` when the session is usable again, `false` when it is gone
 * (the token is cleared), and rejects on a transient failure (rate limit, network).
 */
export function attemptRefreshingSession(): Promise<boolean> {
  if (inFlight === null) {
    const before = getSnapshot();
    inFlight = withCrossTabLock(() => refreshUnderLock(before)).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/**
 * Whether the browser holds a session. A present but expired or unreadable token is refreshed
 * first. The old SDK also probed the server when only the refresh cookie was left; we do not, so a
 * browser in that state signs in again.
 */
export async function doesSessionExist(): Promise<boolean> {
  const snapshot = getSnapshot();
  if (snapshot.status === 'absent') {
    return false;
  }
  if (isUsable(snapshot)) {
    return true;
  }
  try {
    return await attemptRefreshingSession();
  } catch {
    // Transient; stay optimistic and let the next GraphQL NEEDS_REFRESH retry.
    return true;
  }
}

/** Ends the session on the server and forgets it locally even when the server is unreachable. */
export async function signOut(): Promise<void> {
  try {
    await signOutRequest();
  } catch (error) {
    console.error(error);
  } finally {
    clearFrontToken();
  }
}
