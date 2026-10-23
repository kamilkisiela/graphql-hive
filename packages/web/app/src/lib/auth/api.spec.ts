// @vitest-environment jsdom
import * as frontToken from './front-token';

const envOverride = vi.hoisted(() => ({ graphqlPublicOrigin: 'http://localhost:3001' }));
vi.mock('@/env/frontend', async () => {
  const { env } = await import('@/lib/testing/mocks/env');
  return {
    get env() {
      return { ...env, graphqlPublicOrigin: envOverride.graphqlPublicOrigin };
    },
  };
});

const api = await import('./api');

const fetchMock = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>();

// A fresh Response per call: a body can only be read once.
function respondWith(status: number, body?: unknown, headers?: Record<string, string>) {
  fetchMock.mockImplementation(async () =>
    body === undefined
      ? new Response(null, { status, headers })
      : new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json', ...headers },
        }),
  );
}

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1)!;
  const headers = new Headers(init.headers);
  return {
    url: url.toString(),
    method: init.method,
    credentials: init.credentials,
    contentType: headers.get('content-type'),
    body: init.body === undefined ? undefined : JSON.parse(init.body as string),
  };
}

describe('auth api', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    respondWith(200, { status: 'OK' });
    vi.stubGlobal('fetch', fetchMock);
    envOverride.graphqlPublicOrigin = 'http://localhost:3001';
    frontToken.clearFrontToken();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts sign-in form fields with credentials', async () => {
    await expect(api.signIn({ email: 'user@the-guild.dev', password: 'pw' })).resolves.toEqual({
      status: 'OK',
    });
    expect(lastRequest()).toEqual({
      url: 'http://localhost:3001/auth-api/signin',
      method: 'POST',
      credentials: 'include',
      contentType: 'application/json',
      body: {
        formFields: [
          { id: 'email', value: 'user@the-guild.dev' },
          { id: 'password', value: 'pw' },
        ],
      },
    });
  });

  it('builds the URL from an origin with a trailing slash', async () => {
    envOverride.graphqlPublicOrigin = 'http://localhost:3001/';
    await api.signOut();
    expect(lastRequest().url).toBe('http://localhost:3001/auth-api/signout');
  });

  it('sends sign-up, password reset and third-party bodies in the server shapes', async () => {
    await api.signUp({ email: 'e', password: 'p', firstName: 'F', lastName: 'L' });
    expect(lastRequest().body).toEqual({
      formFields: [
        { id: 'email', value: 'e' },
        { id: 'password', value: 'p' },
        { id: 'firstName', value: 'F' },
        { id: 'lastName', value: 'L' },
      ],
    });

    await api.sendPasswordResetEmail({ email: 'e' });
    expect(lastRequest()).toMatchObject({
      url: 'http://localhost:3001/auth-api/user/password/reset/token',
      body: { formFields: [{ id: 'email', value: 'e' }] },
    });

    await api.submitNewPassword({ token: 't', password: 'p' });
    expect(lastRequest()).toMatchObject({
      url: 'http://localhost:3001/auth-api/user/password/reset',
      body: { method: 'token', token: 't', formFields: [{ id: 'password', value: 'p' }] },
    });

    respondWith(200, { status: 'OK', urlWithQueryParams: 'https://idp' });
    await expect(
      api.getAuthorisationUrl({
        thirdPartyId: 'oidc',
        redirectURIOnProviderDashboard: 'http://localhost:3000/auth/callback/oidc',
        oidcId: 'id-1',
      }),
    ).resolves.toEqual({ status: 'OK', urlWithQueryParams: 'https://idp' });
    expect(lastRequest()).toMatchObject({
      url: 'http://localhost:3001/auth-api/authorisationurl?thirdPartyId=oidc&redirectURIOnProviderDashboard=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback%2Foidc&oidc_id=id-1',
      method: 'GET',
      body: undefined,
    });

    respondWith(200, { status: 'OK' });
    await api.thirdPartySignInUp({
      thirdPartyId: 'github',
      redirectURIOnProviderDashboard: 'http://localhost:3000/auth/callback/github',
      redirectURIQueryParams: { code: 'c', state: 's' },
    });
    expect(lastRequest().body).toEqual({
      thirdPartyId: 'github',
      redirectURIInfo: {
        redirectURIOnProviderDashboard: 'http://localhost:3000/auth/callback/github',
        redirectURIQueryParams: { code: 'c', state: 's' },
      },
    });
  });

  it('sends no content-type on the bodiless refresh and sign-out requests', async () => {
    respondWith(200);
    await api.refreshSession();
    expect(lastRequest()).toMatchObject({
      url: 'http://localhost:3001/auth-api/session/refresh',
      method: 'POST',
      credentials: 'include',
      contentType: null,
      body: undefined,
    });

    respondWith(200, { status: 'OK' });
    await api.signOut();
    expect(lastRequest()).toMatchObject({ contentType: null, body: undefined });
  });

  it('stores the front-token header of any response', async () => {
    const raw = btoa(JSON.stringify({ uid: 'user-1', ate: 1, up: {} }));
    respondWith(200, { status: 'OK' }, { 'front-token': raw });
    await api.signIn({ email: 'e', password: 'p' });
    expect(frontToken.getSession()?.userId).toBe('user-1');

    respondWith(200, { status: 'OK' }, { 'front-token': 'remove' });
    await api.signOut();
    expect(frontToken.getSession()).toBeNull();
  });

  it('returns the refresh status without throwing on 404 or 401', async () => {
    respondWith(404);
    await expect(api.refreshSession()).resolves.toBe(404);
    respondWith(401);
    await expect(api.refreshSession()).resolves.toBe(401);
  });

  it('throws the server message verbatim on GENERAL_ERROR', async () => {
    respondWith(200, {
      status: 'GENERAL_ERROR',
      message: 'Something went wrong. Please try again',
    });
    await expect(
      api.getAuthorisationUrl({ thirdPartyId: 'oidc', redirectURIOnProviderDashboard: 'x' }),
    ).rejects.toThrow('Something went wrong. Please try again');
  });

  it('throws on a non-OK status and on the bare 401 body', async () => {
    respondWith(401);
    await expect(api.submitNewPassword({ token: 't', password: 'p' })).rejects.toBeInstanceOf(
      api.AuthApiError,
    );

    respondWith(200, 401);
    await expect(api.signIn({ email: 'e', password: 'p' })).rejects.toBeInstanceOf(
      api.AuthApiError,
    );
  });

  it('looks up an OIDC id and only treats 5xx as an error', async () => {
    respondWith(404, { ok: false, title: 'Not found', description: 'd', status: 404 });
    await expect(api.lookupOidcId({ slug: 'org' })).resolves.toEqual({
      ok: false,
      title: 'Not found',
      description: 'd',
      status: 404,
    });
    expect(lastRequest()).toMatchObject({
      url: 'http://localhost:3001/auth-api/oidc-id-lookup',
      body: { slug: 'org' },
    });

    respondWith(500);
    await expect(api.lookupOidcId({ slug: 'org' })).rejects.toThrow('Server error');
  });
});
