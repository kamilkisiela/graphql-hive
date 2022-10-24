import * as utils from 'dockest/test-helper';
import { createFetch } from '@whatwg-node/fetch';
import { createTRPCClient } from '@trpc/client';
import type { InternalApi } from '@hive/server';
import { z } from 'zod';
import { ensureEnv } from './env';

const graphqlAddress = utils.getServiceAddress('server', 3001);

const { fetch } = createFetch({
  useNodeFetch: true,
});

const internalApi = createTRPCClient<InternalApi>({
  url: `http://${graphqlAddress}/trpc`,
  fetch,
});

const SignUpSignInUserResponseModel = z.object({
  status: z.literal('OK'),
  user: z.object({ email: z.string(), id: z.string(), timeJoined: z.number() }),
});

const signUpUserViaEmail = async (
  email: string,
  password: string
): Promise<z.TypeOf<typeof SignUpSignInUserResponseModel>> => {
  const response = await fetch(`${ensureEnv('SUPERTOKENS_CONNECTION_URI')}/recipe/signup`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'api-key': ensureEnv('SUPERTOKENS_API_KEY'),
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });
  const body = await response.text();
  if (response.status !== 200) {
    throw new Error(`Signup failed. ${response.status}.\n ${body}`);
  }

  return SignUpSignInUserResponseModel.parse(JSON.parse(body));
};

const createSessionPayload = (superTokensUserId: string, email: string) => ({
  version: '1',
  superTokensUserId,
  externalUserId: null,
  email,
});

const CreateSessionModel = z.object({
  accessToken: z.object({
    token: z.string(),
  }),
  refreshToken: z.object({
    token: z.string(),
  }),
  idRefreshToken: z.object({
    token: z.string(),
  }),
});

const createSession = async (superTokensUserId: string, email: string) => {
  // I failed to make the TypeScript work here...
  // It shows that the input type is `undefined`...
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await internalApi.mutation('ensureUser', {
    superTokensUserId,
    email,
  });
  const sessionData = createSessionPayload(superTokensUserId, email);
  const payload = {
    enableAntiCsrf: false,
    userId: superTokensUserId,
    userDataInDatabase: sessionData,
    userDataInJWT: sessionData,
  };

  const response = await fetch(`${ensureEnv('SUPERTOKENS_CONNECTION_URI')}/recipe/session`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'api-key': ensureEnv('SUPERTOKENS_API_KEY'),
      rid: 'session',
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  if (response.status !== 200) {
    throw new Error(`Create session failed. ${response.status}.\n ${body}`);
  }

  const data = CreateSessionModel.parse(JSON.parse(body));

  /**
   * These are the required cookies that need to be set.
   */
  return {
    access_token: data.accessToken.token,
  };
};

type UserID = 'main' | 'extra' | 'admin';
const password = 'ilikebigturtlesandicannotlie47';

export const userEmails: Record<UserID, string> = {
  main: 'main@localhost.localhost',
  extra: 'extra@localhost.localhost',
  admin: 'admin@localhost.localhost',
};

const tokenResponsePromise: Record<UserID, Promise<z.TypeOf<typeof SignUpSignInUserResponseModel>> | null> = {
  main: null,
  extra: null,
  admin: null,
};

export function authenticate(userId: UserID): Promise<{ access_token: string }> {
  if (!tokenResponsePromise[userId]) {
    tokenResponsePromise[userId] = signUpUserViaEmail(userEmails[userId], password);
  }

  return tokenResponsePromise[userId]!.then(data => createSession(data.user.id, data.user.email));
}
