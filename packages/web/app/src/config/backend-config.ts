import ThirdPartyEmailPasswordNode from 'supertokens-node/recipe/thirdpartyemailpassword';
import SessionNode from 'supertokens-node/recipe/session';
import type { TypeInput } from 'supertokens-node/types';
import type { TypeProvider } from 'supertokens-node/recipe/thirdparty/types';
import type { TypeInput as ThirdPartEmailPasswordTypeInput } from 'supertokens-node/recipe/thirdpartyemailpassword/types';
import { fetch } from 'cross-undici-fetch';
import { appInfo } from './app-info';
import zod from 'zod';
import { createTRPCClient } from '@trpc/client';
import type { EmailsApi } from '@hive/emails';

const LegacyAuth0ConfigEnabledModel = zod.object({
  AUTH_LEGACY_AUTH0: zod.literal('1'),
  AUTH_LEGACY_AUTH0_AUDIENCE: zod.string(),
  AUTH_LEGACY_AUTH0_ISSUER_BASE_URL: zod.string(),
  AUTH_LEGACY_AUTH0_CLIENT_ID: zod.string(),
  AUTH_LEGACY_AUTH0_CLIENT_SECRET: zod.string(),
  AUTH_LEGACY_AUTH0_INTERNAL_API_ENDPOINT: zod.string(),
  AUTH_LEGACY_AUTH0_INTERNAL_API_KEY: zod.string(),
});

const LegacyAuth0Config = zod.union([
  zod.object({
    AUTH_LEGACY_AUTH0: zod.union([zod.void(), zod.literal('0')]),
  }),
  LegacyAuth0ConfigEnabledModel,
]);

const EmailTRPCConfig = zod.object({
  EMAILS_ENDPOINT: zod.string(),
});

type LegacyAuth0ConfigEnabled = zod.TypeOf<typeof LegacyAuth0ConfigEnabledModel>;

const GitHubConfigModel = zod.union([
  zod.object({
    NEXT_PUBLIC_AUTH_GITHUB: zod.union([zod.void(), zod.literal('0')]),
  }),
  zod.object({
    NEXT_PUBLIC_AUTH_GITHUB: zod.literal('1'),
    AUTH_GITHUB_CLIENT_ID: zod.string(),
    AUTH_GITHUB_CLIENT_SECRET: zod.string(),
  }),
]);

const GoogleConfigModel = zod.union([
  zod.object({
    NEXT_PUBLIC_AUTH_GOOGLE: zod.union([zod.void(), zod.literal('0')]),
  }),
  zod.object({
    NEXT_PUBLIC_AUTH_GOOGLE: zod.literal('1'),
    AUTH_GOOGLE_CLIENT_ID: zod.string(),
    AUTH_GOOGLE_CLIENT_SECRET: zod.string(),
  }),
]);

const SuperTokensConfigModel = zod.object({
  SUPERTOKENS_CONNECTION_URI: zod.string(),
  SUPERTOKENS_API_KEY: zod.string(),
});

export const backendConfig = (): TypeInput => {
  const githubConfig = GitHubConfigModel.parse(process.env);
  const googleConfig = GoogleConfigModel.parse(process.env);
  const auth0Config = LegacyAuth0Config.parse(process.env);
  const superTokensConfig = SuperTokensConfigModel.parse(process.env);
  const emailConfig = EmailTRPCConfig.parse(process.env);

  const trpcService = createTRPCClient<EmailsApi>({
    url: `${emailConfig['EMAILS_ENDPOINT']}/trpc`,
  });
  const providers: Array<TypeProvider> = [];

  if (githubConfig['NEXT_PUBLIC_AUTH_GITHUB'] === '1') {
    providers.push(
      ThirdPartyEmailPasswordNode.Github({
        clientId: githubConfig['AUTH_GITHUB_CLIENT_ID'],
        clientSecret: githubConfig['AUTH_GITHUB_CLIENT_SECRET'],
      })
    );
  }
  if (googleConfig['NEXT_PUBLIC_AUTH_GOOGLE'] === '1') {
    providers.push(
      ThirdPartyEmailPasswordNode.Google({
        clientId: googleConfig['AUTH_GOOGLE_CLIENT_ID'],
        clientSecret: googleConfig['AUTH_GOOGLE_CLIENT_SECRET'],
      })
    );
  }

  return {
    supertokens: {
      connectionURI: superTokensConfig['SUPERTOKENS_CONNECTION_URI'],
      apiKey: superTokensConfig['SUPERTOKENS_API_KEY'],
    },
    appInfo,
    recipeList: [
      ThirdPartyEmailPasswordNode.init({
        providers,
        emailDelivery: {
          override: originalImplementation => ({
            ...originalImplementation,
            async sendEmail(input) {
              if (input.type === 'EMAIL_VERIFICATION') {
                await trpcService.mutation('sendEmailVerificationEmail', {
                  user: {
                    id: input.user.id,
                    email: input.user.email,
                  },
                  emailVerifyLink: input.emailVerifyLink,
                });

                return Promise.resolve();
              } else if (input.type === 'PASSWORD_RESET') {
                await trpcService.mutation('sendPasswordResetEmail', {
                  user: {
                    id: input.user.id,
                    email: input.user.email,
                  },
                  passwordResetLink: input.passwordResetLink,
                });
                return Promise.resolve();
              }

              return Promise.reject(new Error('Unsupported email type.'));
            },
          }),
        },
        override:
          /**
           * These overrides are only relevant for the legacy Auth0 -> SuperTokens migration (period).
           */
          auth0Config['AUTH_LEGACY_AUTH0'] === '1' ? getAuth0Overrides(auth0Config) : undefined,
      }),
      SessionNode.init({
        override: {
          functions: originalImplementation => {
            return {
              ...originalImplementation,
              createNewSession: async function (input) {
                const user = await ThirdPartyEmailPasswordNode.getUserById(input.userId);

                if (!user) {
                  throw new Error(
                    `SuperTokens: Creating a new session failed. Could not find user with id ${input.userId}.`
                  );
                }

                const externalUserId = user.thirdParty ? `${user.thirdParty.id}|${user.thirdParty.userId}` : null;

                input.accessTokenPayload = {
                  version: '1',
                  superTokensUserId: input.userId,
                  externalUserId,
                  email: user.email,
                };

                input.sessionData = {
                  version: '1',
                  superTokensUserId: input.userId,
                  externalUserId,
                  email: user.email,
                };

                return originalImplementation.createNewSession(input);
              },
            };
          },
        },
      }),
    ],
    isInServerlessEnv: true,
  };
};

//
// LEGACY Auth0 Utilities
// These are only required for the Auth0 -> SuperTokens migrations and can be removed once the migration (period) is complete.
//

const getAuth0Overrides = (config: LegacyAuth0ConfigEnabled) => {
  const override: ThirdPartEmailPasswordTypeInput['override'] = {
    functions(originalImplementation) {
      return {
        ...originalImplementation,
        async emailPasswordSignIn(input) {
          if (await doesUserExistInAuth0(config, input.email)) {
            // check if user exists in SuperTokens
            const superTokensUsers = await this.getUsersByEmail({
              email: input.email,
              userContext: input.userContext,
            });

            const emailPasswordUser =
              // if the thirdParty field in the user object is undefined, then the user is an EmailPassword account.
              superTokensUsers.find(superTokensUser => superTokensUser.thirdParty === undefined) ?? null;

            // EmailPassword user does not exist in SuperTokens
            // We first need to verify whether the password is legit,then if so, create a new user in SuperTokens with the same password.
            if (emailPasswordUser === null) {
              const auth0UserData = await trySignIntoAuth0WithUserCredentialsAndRetrieveUserInfo(
                config,
                input.email,
                input.password
              );

              if (auth0UserData === null) {
                // Invalid credentials -> Sent this to the client.
                return {
                  status: 'WRONG_CREDENTIALS_ERROR',
                };
              }

              // If the Auth0 credentials are correct we can successfully create the user in supertokens.
              const response = await this.emailPasswordSignUp(input);

              if (response.status !== 'OK') {
                return {
                  status: 'WRONG_CREDENTIALS_ERROR',
                };
              }
              await setUserIdMapping(config, {
                auth0UserId: auth0UserData.sub,
                supertokensUserId: response.user.id,
              });

              return response;
            }
          }

          return originalImplementation.emailPasswordSignIn(input);
        },
        async thirdPartySignInUp(input) {
          const externalUserId = `${input.thirdPartyId}|${input.thirdPartyUserId}`;
          // Sign up the user with SuperTokens.
          const response = await originalImplementation.thirdPartySignInUp(input);

          // Auth0 user exists
          if (response.status === 'OK') {
            // We always make sure that we set the user mapping between Auth0 and SuperTokens.
            await setUserIdMapping(config, {
              auth0UserId: externalUserId,
              supertokensUserId: response.user.id,
            });
            response.createdNewUser = false;

            return response;
          }

          // Auth0 user does not exist
          return await originalImplementation.thirdPartySignInUp(input);
        },
      };
    },
  };

  return override;
};

/**
 * Check whether a specific user that SIGNED UP VIA EMAIL and password exists in Auth0.
 */
async function doesUserExistInAuth0(config: LegacyAuth0ConfigEnabled, email: string): Promise<boolean> {
  const access_token = await generateAuth0AccessToken(config);

  // check if a user exists with the input email and is not a Social Account
  const response = await fetch(
    `${process.env.AUTH_LEGACY_AUTH0_AUDIENCE}users?q=${encodeURIComponent(
      `identities.isSocial:false AND email:${email}`
    )}`,
    {
      method: 'GET',
      headers: { authorization: `Bearer ${access_token}` },
    }
  );

  if (response.status !== 200) {
    throw new Error('Could not check whether user exists in Auth0.');
  }

  const body = await response.json();

  if (body[0] !== undefined) {
    return true;
  }
  return false;
}

/**
 * try to authenticate a user with Auth0 and if successful return the user info.
 */
async function trySignIntoAuth0WithUserCredentialsAndRetrieveUserInfo(
  config: LegacyAuth0ConfigEnabled,
  email: string,
  password: string
): Promise<{ sub: string } | null> {
  // generate an user access token using the input credentials
  const response = await fetch(`${config['AUTH_LEGACY_AUTH0_ISSUER_BASE_URL']}/oauth/token`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config['AUTH_LEGACY_AUTH0_CLIENT_ID'],
      client_secret: config['AUTH_LEGACY_AUTH0_CLIENT_SECRET'],
      grant_type: 'password',
      username: email,
      password: password,
    }),
  });

  const body = await response.text();

  if (response.status !== 200) {
    throw new Error("Couldn't authenticate user with Auth0.");
  }

  const { access_token: accessToken } = JSON.parse(body);

  const userResponse = await fetch(`${process.env['AUTH_LEGACY_AUTH0_ISSUER_BASE_URL']}/userInfo`, {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (userResponse.status !== 200) {
    return null;
  }

  const userBody = await userResponse.text();
  return JSON.parse(userBody);
}

/**
 * Handler for updating the auth0UserId to superTokensUserId mapping within the users table of the Postgres database.
 * We do this via an HTTP call to our API service instead of directly connecting to the database here (in a serverless context).
 */
async function setUserIdMapping(
  config: LegacyAuth0ConfigEnabled,
  params: { auth0UserId: string; supertokensUserId: string }
): Promise<void> {
  const response = await fetch(config['AUTH_LEGACY_AUTH0_INTERNAL_API_ENDPOINT'] + '/update_user_id_mapping', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-authorization': config['AUTH_LEGACY_AUTH0_INTERNAL_API_KEY'],
    },
    body: JSON.stringify({
      auth0UserId: params.auth0UserId,
      superTokensUserId: params.supertokensUserId,
    }),
  });

  if (response.status !== 200) {
    throw new Error('Failed to set user id mapping code.');
  }
}

/**
 * Generate a Auth0 access token that is required for making API calls to Auth0.
 */
const generateAuth0AccessToken = async (config: LegacyAuth0ConfigEnabled): Promise<string> => {
  const response = await fetch(`${config['AUTH_LEGACY_AUTH0_ISSUER_BASE_URL']}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: config['AUTH_LEGACY_AUTH0_CLIENT_ID'],
      client_secret: config['AUTH_LEGACY_AUTH0_CLIENT_SECRET'],
      audience: config['AUTH_LEGACY_AUTH0_AUDIENCE'],
      grant_type: 'client_credentials',
    }),
  });

  const body = await response.text();

  if (response.status !== 200) {
    throw new Error(`Couldn't generate access token for Auth0. Status: ${response.status} Body:${body}`);
  }

  return JSON.parse(body).access_token;
};
