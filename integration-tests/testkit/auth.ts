import { z } from 'zod';
import type { InternalApi } from '@hive/server';
import { createTRPCProxyClient, httpLink } from '@trpc/client';
import { createFetch } from '@whatwg-node/fetch';
import { ensureEnv } from './env';
import { getServiceHost } from './utils';

const { fetch } = createFetch({
  useNodeFetch: true,
});

const SignUpSignInUserResponseModel = z.object({
  status: z.literal('OK'),
  user: z.object({ email: z.string(), id: z.string(), timeJoined: z.number() }),
});

const signUpUserViaEmail = async (
  email: string,
  password: string,
): Promise<z.TypeOf<typeof SignUpSignInUserResponseModel>> => {
  try {
    const response = await fetch(`${ensureEnv('SUPERTOKENS_CONNECTION_URI')}/recipe/signup`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'api-key': ensureEnv('SUPERTOKENS_API_KEY'),
        'cdi-version': '2.20',
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
  } catch (e) {
    console.warn(`Failed to sign up:`, e);

    throw e;
  }
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

const createSession = async (
  superTokensUserId: string,
  email: string,
  oidcIntegrationId: string | null,
) => {
  try {
    const graphqlAddress = await getServiceHost('server', 8082);

    const internalApi = createTRPCProxyClient<InternalApi>({
      links: [
        httpLink({
          url: `http://${graphqlAddress}/trpc`,
          fetch,
        }),
      ],
    });

    await internalApi.ensureUser.mutate({
      superTokensUserId,
      email,
      oidcIntegrationId,
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
        'cdi-version': '2.20',
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
  } catch (e) {
    console.warn(`Failed to create session:`, e);
    throw e;
  }
};

const password = 'ilikebigturtlesandicannotlie47';

export function userEmail(userId: string) {
  return `${userId}-${Date.now()}@localhost.localhost`;
}

const tokenResponsePromise: {
  [key: string]: Promise<z.TypeOf<typeof SignUpSignInUserResponseModel>> | null;
} = {};

export function authenticate(email: string): Promise<{ access_token: string }>;
export function authenticate(
  email: string,
  oidcIntegrationId?: string,
): Promise<{ access_token: string }>;
export function authenticate(
  email: string | string,
  oidcIntegrationId?: string,
): Promise<{ access_token: string }> {
  if (!tokenResponsePromise[email]) {
    tokenResponsePromise[email] = signUpUserViaEmail(email, password);
  }

  return tokenResponsePromise[email]!.then(data =>
    createSession(data.user.id, data.user.email, oidcIntegrationId ?? null),
  );
}
