import { AuthenticationClient, TokenResponse } from 'auth0';
import { ensureEnv } from './env';

const authenticationApi = new AuthenticationClient({
  domain: ensureEnv('AUTH0_DOMAIN'),
  clientId: ensureEnv('AUTH0_CLIENT_ID'),
  clientSecret: ensureEnv('AUTH0_CLIENT_SECRET'),
});

type UserID = 'main' | 'extra' | 'admin';
const password = ensureEnv('AUTH0_USER_PASSWORD');

const userEmails: Record<UserID, string> = {
  main: ensureEnv('AUTH0_USER_MAIN_EMAIL'),
  extra: ensureEnv('AUTH0_USER_EXTRA_EMAIL'),
  admin: ensureEnv('AUTH0_USER_ADMIN_EMAIL'),
};

const tokenResponsePromise: Record<UserID, Promise<TokenResponse> | null> = {
  main: null,
  extra: null,
  admin: null,
};

export function authenticate(userId: UserID) {
  if (!tokenResponsePromise[userId]) {
    tokenResponsePromise[userId] = authenticationApi.passwordGrant({
      username: userEmails[userId],
      password,
      audience: `https://${ensureEnv('AUTH0_DOMAIN')}/api/v2/`,
      scope: 'openid profile email offline_access',
      realm: 'Username-Password-Authentication',
    });
  }

  return tokenResponsePromise[userId]!;
}
