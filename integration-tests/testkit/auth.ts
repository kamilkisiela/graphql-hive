import * as utils from 'dockest/test-helper';
import { createFetch } from '@whatwg-node/fetch';
import zod from 'zod';
import { ensureEnv } from './env';

const graphqlAddress = utils.getServiceAddress('server', 3001);

const { fetch } = createFetch({
  useNodeFetch: true,
});

const SignUpSignInUserResponseModel = zod.object({
  status: zod.literal('OK'),
  user: zod.object({ email: zod.string(), id: zod.string(), timeJoined: zod.number() }),
});

const signUpUserViaEmail = async (
  email: string,
  password: string
): Promise<zod.TypeOf<typeof SignUpSignInUserResponseModel>> => {
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

const CreateSessionModel = zod.object({
  accessToken: zod.object({
    token: zod.string(),
  }),
  refreshToken: zod.object({
    token: zod.string(),
  }),
  idRefreshToken: zod.object({
    token: zod.string(),
  }),
});

async function ensureUserCreation(input: { superTokensUserId: string; email: string }) {
  const response = await fetch(`http://${graphqlAddress}/graphql`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-internal-signature': ensureEnv('INTERNAL_ACCESS_SIGNATURE'),
      'graphql-client-name': 'Integration Tests',
      'graphql-client-version': 'integration-tests',
    },
    body: JSON.stringify({
      operationName: 'ensureUserCreation',
      query: /* GraphQL */ `
        mutation ensureUserCreation($input: EnsureMeInput!) {
          ensureMe(input: $input)
        }
      `,
      variables: {
        input,
      },
    }),
  });

  const result = await response.json();

  if ('errors' in result) {
    console.error(result);
    throw new Error('Failed to ensure user creation');
  }
}

const createSession = async (superTokensUserId: string, email: string) => {
  await ensureUserCreation({ superTokensUserId, email });
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

const tokenResponsePromise: Record<UserID, Promise<zod.TypeOf<typeof SignUpSignInUserResponseModel>> | null> = {
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
