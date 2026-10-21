// @vitest-environment jsdom
import { completeThirdPartyAuth, startThirdPartyAuth } from './third-party';

vi.mock('@/env/frontend', async () => {
  const { env } = await import('@/lib/testing/mocks/env');
  return { env: { ...env, auth: { ...env.auth, github: true, oidc: true } } };
});
const api = vi.hoisted(() => ({
  getAuthorisationUrl: vi.fn<(input: unknown) => Promise<unknown>>(),
  thirdPartySignInUp: vi.fn<(input: unknown) => Promise<unknown>>(),
}));
vi.mock('./api', () => api);

const location = { assign: vi.fn(), search: '', protocol: 'http:' };

describe('third-party auth', () => {
  beforeEach(() => {
    api.getAuthorisationUrl.mockReset();
    api.thirdPartySignInUp.mockReset();
    location.assign.mockReset();
    location.search = '';
    vi.stubGlobal('location', location);
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('start', () => {
    it('sends the browser to the URL the server built, untouched', async () => {
      api.getAuthorisationUrl.mockResolvedValue({
        status: 'OK',
        urlWithQueryParams: 'https://github.com/login/oauth/authorize?state=server-state&x=1',
      });

      await startThirdPartyAuth('github', '/org/x');

      expect(api.getAuthorisationUrl.mock.calls[0]?.[0]).toEqual({
        thirdPartyId: 'github',
        redirectURIOnProviderDashboard: 'http://localhost:3000/auth/callback/github',
        oidcId: undefined,
      });
      expect(location.assign).toHaveBeenCalledWith(
        'https://github.com/login/oauth/authorize?state=server-state&x=1',
      );
      expect(JSON.parse(sessionStorage.getItem('hive:auth-flow')!)).toEqual({
        state: 'server-state',
        redirectToPath: '/org/x',
      });
      expect(document.cookie).toContain('last-used-auth-method=github');
    });

    it('passes the OIDC integration id along', async () => {
      api.getAuthorisationUrl.mockResolvedValue({
        status: 'OK',
        urlWithQueryParams: 'https://idp',
      });
      await startThirdPartyAuth('oidc', undefined, 'integration-1');
      expect(api.getAuthorisationUrl.mock.calls[0]?.[0]).toMatchObject({
        thirdPartyId: 'oidc',
        oidcId: 'integration-1',
      });
      expect(JSON.parse(sessionStorage.getItem('hive:auth-flow')!)).toEqual({
        state: null,
        redirectToPath: '/',
      });
    });

    it('refuses a provider that is not configured, without a request', async () => {
      await expect(startThirdPartyAuth('google')).rejects.toThrow('not configured');
      expect(api.getAuthorisationUrl).not.toHaveBeenCalled();
    });

    it('surfaces the server message, which the OIDC page shows', async () => {
      api.getAuthorisationUrl.mockRejectedValue(
        new Error('Something went wrong. Please try again'),
      );
      await expect(startThirdPartyAuth('oidc', '/', 'invalid')).rejects.toThrow(
        'Something went wrong. Please try again',
      );
      expect(location.assign).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    function stash(flow: { state: string | null; redirectToPath: string }) {
      sessionStorage.setItem('hive:auth-flow', JSON.stringify(flow));
    }

    it('forwards every callback parameter and hands back the stashed path, once', async () => {
      location.search = '?code=c&state=s&iss=https%3A%2F%2Fidp&session_state=ss';
      stash({ state: 's', redirectToPath: '/org/x?tab=1' });
      api.thirdPartySignInUp.mockResolvedValue({ status: 'OK' });

      await expect(completeThirdPartyAuth('oidc')).resolves.toEqual({
        status: 'OK',
        redirectToPath: '/org/x?tab=1',
      });
      expect(api.thirdPartySignInUp.mock.calls[0]?.[0]).toEqual({
        thirdPartyId: 'oidc',
        redirectURIOnProviderDashboard: 'http://localhost:3000/auth/callback/oidc',
        redirectURIQueryParams: { code: 'c', state: 's', iss: 'https://idp', session_state: 'ss' },
      });

      // The flow is consumed: the same callback cannot be completed twice.
      await expect(completeThirdPartyAuth('oidc')).rejects.toThrow('not started from this browser');
      expect(api.thirdPartySignInUp).toHaveBeenCalledTimes(1);
    });

    it('refuses a callback whose state this browser did not ask for', async () => {
      location.search = '?code=c&state=someone-elses';
      stash({ state: 's', redirectToPath: '/' });
      await expect(completeThirdPartyAuth('github')).rejects.toThrow(
        'not started from this browser',
      );
      expect(api.thirdPartySignInUp).not.toHaveBeenCalled();

      location.search = '?code=c&state=s';
      await expect(completeThirdPartyAuth('github')).rejects.toThrow(
        'not started from this browser',
      );
      expect(api.thirdPartySignInUp).not.toHaveBeenCalled();
    });

    it('drops a stashed path that does not stay in the app', async () => {
      location.search = '?code=c&state=s';
      stash({ state: 's', redirectToPath: 'https://evil.example/' });
      api.thirdPartySignInUp.mockResolvedValue({ status: 'OK' });
      await expect(completeThirdPartyAuth('github')).resolves.toEqual({
        status: 'OK',
        redirectToPath: '/',
      });
    });

    it('reports a provider error with fixed copy, before calling the server', async () => {
      location.search = '?error=access_denied&error_description=User+said+no&state=s';
      stash({ state: 's', redirectToPath: '/' });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      await expect(completeThirdPartyAuth('github')).rejects.toThrow(
        'The sign-in provider reported an error',
      );
      expect(api.thirdPartySignInUp).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledWith(
        'Sign-in provider error',
        'access_denied',
        'User said no',
      );
      consoleError.mockRestore();
    });

    it('passes a refusal through', async () => {
      location.search = '?code=c&state=s';
      stash({ state: 's', redirectToPath: '/' });
      api.thirdPartySignInUp.mockResolvedValue({
        status: 'SIGN_IN_UP_NOT_ALLOWED',
        reason: 'Sign in not allowed.',
      });
      await expect(completeThirdPartyAuth('github')).resolves.toEqual({
        status: 'SIGN_IN_UP_NOT_ALLOWED',
        reason: 'Sign in not allowed.',
      });
    });
  });
});
