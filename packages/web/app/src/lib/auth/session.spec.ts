// @vitest-environment jsdom
import { isRedirect } from '@tanstack/react-router';
import { applyFrontTokenHeader, clearFrontToken, getSession, getSnapshot } from './front-token';
import { requireSession } from './require-session';
import { attemptRefreshingSession, doesSessionExist, signOut } from './session';

vi.mock('@/env/frontend', () => import('@/lib/testing/mocks/env'));

function encode(token: { uid: string; ate: number }): string {
  return btoa(JSON.stringify({ ...token, up: { email: 'user@the-guild.dev' } }));
}

const fresh = encode({ uid: 'user-1', ate: Date.now() + 60_000 });
const expired = encode({ uid: 'user-1', ate: Date.now() - 60_000 });

const fetchMock = vi.fn<() => Promise<Response>>();

function respondWith(status: number, headers?: Record<string, string>) {
  fetchMock.mockImplementation(async () => new Response(null, { status, headers }));
}

function installLocks(onRequest: () => void = () => {}) {
  const request = vi.fn(async (_name: string, callback: () => Promise<unknown>) => {
    onRequest();
    return callback();
  });
  Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
  return request;
}

describe('session', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    clearFrontToken();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (navigator as { locks?: unknown }).locks;
  });

  describe('doesSessionExist', () => {
    it('is false without a token and true with a usable one, without a request', async () => {
      await expect(doesSessionExist()).resolves.toBe(false);
      applyFrontTokenHeader(fresh);
      await expect(doesSessionExist()).resolves.toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refreshes an expired token and keeps the new one', async () => {
      applyFrontTokenHeader(expired);
      const rotated = encode({ uid: 'user-1', ate: Date.now() + 120_000 });
      respondWith(200, { 'front-token': rotated });

      await expect(doesSessionExist()).resolves.toBe(true);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(getSnapshot()).toMatchObject({ status: 'valid', raw: rotated });
    });

    it('refreshes an unreadable token too', async () => {
      document.cookie = 'sFrontToken=garbage; path=/';
      respondWith(200, { 'front-token': fresh });
      await expect(doesSessionExist()).resolves.toBe(true);
      expect(getSession()?.userId).toBe('user-1');
    });

    it('forgets the session when the refresh answers 404', async () => {
      applyFrontTokenHeader(expired);
      respondWith(404);
      await expect(doesSessionExist()).resolves.toBe(false);
      expect(getSnapshot()).toEqual({ status: 'absent' });
    });

    it('stays optimistic on a transient failure and keeps the token', async () => {
      applyFrontTokenHeader(expired);
      respondWith(401);
      await expect(doesSessionExist()).resolves.toBe(true);
      expect(getSnapshot()).toMatchObject({ status: 'valid', raw: expired });
    });
  });

  describe('attemptRefreshingSession', () => {
    it('rejects on a rate limit without clearing the token', async () => {
      applyFrontTokenHeader(expired);
      respondWith(401);
      await expect(attemptRefreshingSession()).rejects.toThrow('401');
      expect(getSnapshot()).toMatchObject({ raw: expired });
    });

    it('shares one request between concurrent callers', async () => {
      applyFrontTokenHeader(expired);
      respondWith(200, { 'front-token': fresh });
      const results = await Promise.all([attemptRefreshingSession(), attemptRefreshingSession()]);
      expect(results).toEqual([true, true]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('refreshes under the cross-tab lock when one is available', async () => {
      applyFrontTokenHeader(expired);
      respondWith(200, { 'front-token': fresh });
      const request = installLocks();
      await expect(attemptRefreshingSession()).resolves.toBe(true);
      expect(request).toHaveBeenCalledWith('hive:session-refresh', expect.any(Function));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('skips the request when another tab refreshed while it waited for the lock', async () => {
      applyFrontTokenHeader(expired);
      installLocks(() => {
        document.cookie = `sFrontToken=${fresh}; path=/`;
      });
      await expect(attemptRefreshingSession()).resolves.toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports no session when another tab cleared the token while it waited', async () => {
      applyFrontTokenHeader(expired);
      installLocks(() => {
        document.cookie = 'sFrontToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      });
      await expect(attemptRefreshingSession()).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('asks the server when there was no front token to begin with', async () => {
      respondWith(200, { 'front-token': fresh });
      await expect(attemptRefreshingSession()).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(getSession()?.userId).toBe('user-1');
    });

    it('still requests when the token it finds after the lock is also expired', async () => {
      applyFrontTokenHeader(expired);
      const otherExpired = encode({ uid: 'user-1', ate: Date.now() - 30_000 });
      respondWith(200, { 'front-token': fresh });
      installLocks(() => {
        document.cookie = `sFrontToken=${otherExpired}; path=/`;
      });
      await expect(attemptRefreshingSession()).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('signOut', () => {
    it('clears the token even when the request fails', async () => {
      applyFrontTokenHeader(fresh);
      fetchMock.mockRejectedValue(new Error('offline'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      await expect(signOut()).resolves.toBeUndefined();
      expect(getSnapshot()).toEqual({ status: 'absent' });
      consoleError.mockRestore();
    });
  });

  describe('requireSession', () => {
    it('passes with a session and redirects to sign-in with the current href without one', async () => {
      applyFrontTokenHeader(fresh);
      await expect(requireSession({ location: { href: '/org/x?tab=1' } })).resolves.toBeUndefined();

      clearFrontToken();
      const thrown = await requireSession({ location: { href: '/org/x?tab=1' } }).catch(
        error => error,
      );
      expect(isRedirect(thrown)).toBe(true);
      expect(thrown.options).toMatchObject({
        to: '/auth',
        search: { redirectToPath: '/org/x?tab=1' },
      });
    });
  });
});
