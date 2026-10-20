// @vitest-environment jsdom
import {
  applyFrontTokenHeader,
  clearFrontToken,
  getSession,
  getSnapshot,
  subscribe,
} from './front-token';

function encode(token: unknown): string {
  return btoa(JSON.stringify(token));
}

function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find(entry => entry.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function clearAllCookies() {
  for (const entry of document.cookie.split('; ')) {
    const name = entry.split('=')[0];
    if (name) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  }
}

const token = {
  uid: 'user-1',
  ate: 1_700_000_000_000,
  up: { superTokensUserId: 'user-1', email: 'user@the-guild.dev', oidcIntegrationId: null },
};

describe('front token', () => {
  beforeEach(() => {
    clearAllCookies();
  });

  it('is absent without a cookie', () => {
    expect(getSnapshot()).toEqual({ status: 'absent' });
    expect(getSession()).toBeNull();
  });

  it('reads a raw base64 cookie the SDK or the e2e helper wrote', () => {
    const raw = encode(token);
    document.cookie = `sFrontToken=${raw}; path=/`;
    expect(getSession()).toEqual({
      userId: 'user-1',
      email: 'user@the-guild.dev',
      oidcIntegrationId: null,
      accessTokenExpiresAt: 1_700_000_000_000,
    });
  });

  it('reads a percent-encoded cookie value too', () => {
    // The base64 padding becomes %3D, which js-cookie decodes on read.
    const raw = encode({ ...token, up: { ...token.up, email: 'a+b/c@the-guild.dev' } });
    expect(raw).toMatch(/=$/);
    document.cookie = `sFrontToken=${encodeURIComponent(raw)}; path=/`;
    expect(getSession()?.email).toBe('a+b/c@the-guild.dev');
  });

  it('accepts a legacy payload without an email', () => {
    document.cookie = `sFrontToken=${encode({ uid: 'user-1', ate: 1, up: { version: '1' } })}; path=/`;
    expect(getSession()).toEqual({
      userId: 'user-1',
      email: undefined,
      oidcIntegrationId: null,
      accessTokenExpiresAt: 1,
    });
  });

  it('reports an unreadable cookie as invalid instead of throwing', () => {
    document.cookie = 'sFrontToken=garbage; path=/';
    expect(getSnapshot()).toEqual({ status: 'invalid', raw: 'garbage' });
    expect(getSession()).toBeNull();
  });

  it('returns the same snapshot object while the cookie is unchanged', () => {
    document.cookie = `sFrontToken=${encode(token)}; path=/`;
    const first = getSnapshot();
    expect(getSnapshot()).toBe(first);
    document.cookie = `sFrontToken=${encode({ ...token, ate: 2 })}; path=/`;
    expect(getSnapshot()).not.toBe(first);
  });

  it('stores a front-token header with the SDK marker cookie and notifies', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    const raw = encode(token);

    applyFrontTokenHeader(raw);

    expect(readCookie('sFrontToken')).toBe(raw);
    expect(readCookie('st-last-access-token-update')).toMatch(/^\d+$/);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('ignores a response without the header', () => {
    const listener = vi.fn();
    subscribe(listener);
    document.cookie = `sFrontToken=${encode(token)}; path=/`;

    applyFrontTokenHeader(null);

    expect(getSession()?.userId).toBe('user-1');
    expect(listener).not.toHaveBeenCalled();
  });

  it('clears everything on "remove" and on an explicit clear', () => {
    document.cookie = `sFrontToken=${encode(token)}; path=/`;
    document.cookie = 'st-last-access-token-update=1; path=/';
    document.cookie = 'sIRTFrontend=EXISTS; path=/';

    applyFrontTokenHeader('remove');
    expect(document.cookie).toBe('');
    expect(getSnapshot()).toEqual({ status: 'absent' });

    document.cookie = `sFrontToken=${encode(token)}; path=/`;
    clearFrontToken();
    expect(document.cookie).toBe('');
  });
});
