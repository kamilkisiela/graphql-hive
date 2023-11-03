import * as crypto from 'node:crypto';
import { OverrideableBuilder } from 'supertokens-js-override/lib/build';
import EmailVerification from 'supertokens-node/recipe/emailverification';
import SessionNode from 'supertokens-node/recipe/session';
import { TypeProvider } from 'supertokens-node/recipe/thirdparty/types';
import ThirdPartyEmailPasswordNode from 'supertokens-node/recipe/thirdpartyemailpassword';
import { TypeInput as ThirdPartEmailPasswordTypeInput } from 'supertokens-node/recipe/thirdpartyemailpassword/types';
import { TypeInput } from 'supertokens-node/types';
import zod from 'zod';
import { env } from '@/env/backend';
import { appInfo } from '@/lib/supertokens/app-info';
import {
  createOIDCSuperTokensNoopProvider,
  getOIDCThirdPartyEmailPasswordNodeOverrides,
} from '@/lib/supertokens/third-party-email-password-node-oidc-provider';
import { createThirdPartyEmailPasswordNodeOktaProvider } from '@/lib/supertokens/third-party-email-password-node-okta-provider';
// eslint-disable-next-line import/no-extraneous-dependencies -- TODO: should we move to "dependencies"?
import { EmailsApi } from '@hive/emails';
// eslint-disable-next-line import/no-extraneous-dependencies -- TODO: should we move to "dependencies"?
import { type InternalApi } from '@hive/server';
import { createTRPCProxyClient, CreateTRPCProxyClient, httpLink } from '@trpc/client';
import { fetch } from '@whatwg-node/fetch';

export const backendConfig = (): TypeInput => {
  const emailsService = createTRPCProxyClient<EmailsApi>({
    links: [httpLink({ url: `${env.emailsEndpoint}/trpc` })],
  });
  const internalApi = createTRPCProxyClient<InternalApi>({
    links: [httpLink({ url: `${env.serverEndpoint}/trpc` })],
  });
  const providers: TypeProvider[] = [];

  if (env.auth.github) {
    providers.push(
      ThirdPartyEmailPasswordNode.Github({
        clientId: env.auth.github.clientId,
        clientSecret: env.auth.github.clientSecret,
        scope: ['read:user', 'user:email'],
      }),
    );
  }
  if (env.auth.google) {
    providers.push(
      ThirdPartyEmailPasswordNode.Google({
        clientId: env.auth.google.clientId,
        clientSecret: env.auth.google.clientSecret,
        scope: [
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'openid',
        ],
      }),
    );
  }

  if (env.auth.okta) {
    providers.push(createThirdPartyEmailPasswordNodeOktaProvider(env.auth.okta));
  }

  if (env.auth.organizationOIDC) {
    providers.push(createOIDCSuperTokensNoopProvider());
  }

  return {
    supertokens: {
      connectionURI: env.supertokens.connectionUri,
      apiKey: env.supertokens.apiKey,
    },
    appInfo: appInfo(),
    recipeList: [
      ThirdPartyEmailPasswordNode.init({
        providers,
        emailDelivery: {
          override: originalImplementation => ({
            ...originalImplementation,
            async sendEmail(input) {
              if (input.type === 'PASSWORD_RESET') {
                await emailsService.sendPasswordResetEmail.mutate({
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
        override: composeSuperTokensOverrides([
          getEnsureUserOverrides(internalApi),
          env.auth.organizationOIDC
            ? getOIDCThirdPartyEmailPasswordNodeOverrides({ internalApi })
            : null,
          /**
           * These overrides are only relevant for the legacy Auth0 -> SuperTokens migration (period).
           */
          env.auth.legacyAuth0 ? getAuth0Overrides(env.auth.legacyAuth0) : null,
        ]),
      }),
      EmailVerification.init({
        mode: env.auth.requireEmailVerification ? 'REQUIRED' : 'OPTIONAL',
        emailDelivery: {
          override: originalImplementation => ({
            ...originalImplementation,
            async sendEmail(input) {
              if (input.type === 'EMAIL_VERIFICATION') {
                await emailsService.sendEmailVerificationEmail.mutate({
                  user: {
                    id: input.user.id,
                    email: input.user.email,
                  },
                  emailVerifyLink: input.emailVerifyLink,
                });

                return Promise.resolve();
              }
            },
          }),
        },
      }),
      SessionNode.init({
        override: {
          functions: originalImplementation => ({
            ...originalImplementation,
            async createNewSession(input) {
              const user = await ThirdPartyEmailPasswordNode.getUserById(input.userId);

              if (!user) {
                throw new Error(
                  `SuperTokens: Creating a new session failed. Could not find user with id ${input.userId}.`,
                );
              }

              const externalUserId = user.thirdParty
                ? `${user.thirdParty.id}|${user.thirdParty.userId}`
                : null;

              input.accessTokenPayload = {
                version: '1',
                superTokensUserId: input.userId,
                externalUserId,
                email: user.email,
              };

              input.sessionDataInDatabase = {
                version: '1',
                superTokensUserId: input.userId,
                externalUserId,
                email: user.email,
              };

              return originalImplementation.createNewSession(input);
            },
          }),
        },
      }),
    ],
    isInServerlessEnv: true,
  };
};

const getEnsureUserOverrides = (
  internalApi: CreateTRPCProxyClient<InternalApi>,
): ThirdPartEmailPasswordTypeInput['override'] => ({
  apis: originalImplementation => ({
    ...originalImplementation,
    emailPasswordSignUpPOST: async input => {
      if (!originalImplementation.emailPasswordSignUpPOST) {
        throw Error('emailPasswordSignUpPOST is not available');
      }

      const response = await originalImplementation.emailPasswordSignUpPOST(input);

      if (response.status === 'OK') {
        await internalApi.ensureUser.mutate({
          superTokensUserId: response.user.id,
          email: response.user.email,
          oidcIntegrationId: null,
        });
      }

      return response;
    },
    async emailPasswordSignInPOST(input) {
      if (originalImplementation.emailPasswordSignInPOST === undefined) {
        throw Error('Should never come here');
      }

      const response = await originalImplementation.emailPasswordSignInPOST(input);

      if (response.status === 'OK') {
        await internalApi.ensureUser.mutate({
          superTokensUserId: response.user.id,
          email: response.user.email,
          oidcIntegrationId: null,
        });
      }

      return response;
    },
    async thirdPartySignInUpPOST(input) {
      if (originalImplementation.thirdPartySignInUpPOST === undefined) {
        throw Error('Should never come here');
      }

      const response = await originalImplementation.thirdPartySignInUpPOST(input);

      if (response.status === 'OK') {
        await internalApi.ensureUser.mutate({
          superTokensUserId: response.user.id,
          email: response.user.email,
          // This is provided via `getOIDCThirdPartyEmailPasswordNodeOverrides` if it is enabled.
          oidcIntegrationId: input.userContext['oidcIntegrationId'] ?? null,
        });
      }

      return response;
    },
    async passwordResetPOST(input) {
      const result = await originalImplementation.passwordResetPOST!(input);

      // For security reasons we revoke all sessions when a password reset is performed.
      if (result.status === 'OK' && result.userId) {
        await SessionNode.revokeAllSessionsForUser(result.userId);
      }

      return result;
    },
  }),
});

const bindObjectFunctions = <T extends { [key: string]: CallableFunction | undefined }>(
  obj: T,
  bindTo: any,
) => {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, value?.bind(bindTo)]),
  ) as T;
};

/**
 * Utility function for composing multiple (dynamic SuperTokens overrides).
 */
const composeSuperTokensOverrides = (
  overrides: Array<ThirdPartEmailPasswordTypeInput['override'] | null>,
) => ({
  apis(
    originalImplementation: ReturnType<
      Exclude<Exclude<ThirdPartEmailPasswordTypeInput['override'], undefined>['apis'], undefined>
    >,
    builder: OverrideableBuilder<ThirdPartyEmailPasswordNode.APIInterface> | undefined,
  ) {
    let impl = originalImplementation;
    for (const override of overrides) {
      if (typeof override?.apis === 'function') {
        impl = bindObjectFunctions(override.apis(impl, builder), originalImplementation);
      }
    }
    return impl;
  },
  functions(
    originalImplementation: ReturnType<
      Exclude<
        Exclude<ThirdPartEmailPasswordTypeInput['override'], undefined>['functions'],
        undefined
      >
    >,
  ) {
    let impl = originalImplementation;
    for (const override of overrides) {
      if (typeof override?.functions === 'function') {
        impl = bindObjectFunctions(override.functions(impl), originalImplementation);
      }
    }
    return impl;
  },
});

//
// LEGACY Auth0 Utilities
// These are only required for the Auth0 -> SuperTokens migrations and can be removed once the migration (period) is complete.
//

const getAuth0Overrides = (config: Exclude<typeof env.auth.legacyAuth0, null>) => {
  const apis: NonNullable<
    ThirdPartEmailPasswordTypeInput['override']
  >['apis'] = originalImplementation => {
    return {
      ...originalImplementation,
      async generatePasswordResetTokenPOST(input) {
        const email = input.formFields.find(formField => formField.id === 'email')?.value;

        if (email) {
          // We first use the existing implementation for looking for users within supertokens.
          const users = await ThirdPartyEmailPasswordNode.getUsersByEmail(email);

          // If there is no email/password SuperTokens user yet, we need to check if there is an Auth0 user for this email.
          if (!users.some(user => user.thirdParty == null)) {
            // RPC call to check if email/password user exists in Auth0
            const dbUser = await checkWhetherAuth0EmailUserWithoutAssociatedSuperTokensIdExists(
              config,
              { email },
            );

            if (dbUser) {
              // If we have this user within our database we create our new supertokens user
              const newUserResult = await ThirdPartyEmailPasswordNode.emailPasswordSignUp(
                dbUser.email,
                await generateRandomPassword(),
              );

              if (newUserResult.status === 'OK') {
                // link the db record to the new supertokens user
                await setUserIdMapping(config, {
                  auth0UserId: dbUser.auth0UserId,
                  supertokensUserId: newUserResult.user.id,
                });
              }
            }
          }
        }

        return originalImplementation.generatePasswordResetTokenPOST!(input);
      },
    };
  };

  const functions: NonNullable<
    ThirdPartEmailPasswordTypeInput['override']
  >['functions'] = originalImplementation => {
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
            superTokensUsers.find(superTokensUser => superTokensUser.thirdParty === undefined) ??
            null;

          // EmailPassword user does not exist in SuperTokens
          // We first need to verify whether the password is legit,then if so, create a new user in SuperTokens with the same password.
          if (emailPasswordUser === null) {
            const auth0UserData = await trySignIntoAuth0WithUserCredentialsAndRetrieveUserInfo(
              config,
              input.email,
              input.password,
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
  };

  return {
    apis,
    functions,
  };
};

/**
 * Check whether a specific user that SIGNED UP VIA EMAIL and password exists in Auth0.
 */
async function doesUserExistInAuth0(
  config: Exclude<typeof env.auth.legacyAuth0, null>,
  email: string,
): Promise<boolean> {
  const access_token = await generateAuth0AccessToken(config);

  // check if a user exists with the input email and is not a Social Account
  const response = await fetch(
    `${config.audience}users?q=${encodeURIComponent(
      `identities.isSocial:false AND email:${email}`,
    )}`,
    {
      method: 'GET',
      headers: { authorization: `Bearer ${access_token}` },
    },
  );

  if (response.status !== 200) {
    throw new Error(
      `Could not check whether user exists in Auth0. Status: ${
        response.status
      } Body: ${await response.text()}`,
    );
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
  config: Exclude<typeof env.auth.legacyAuth0, null>,
  email: string,
  password: string,
): Promise<{ sub: string } | null> {
  // generate an user access token using the input credentials
  const response = await fetch(`${config.issuerBaseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'password',
      username: email,
      password,
    }),
  });

  const body = await response.text();

  if (response.status === 403) {
    return null;
  }

  if (response.status !== 200) {
    throw new Error(
      `Couldn't authenticate user with Auth0. Status: ${response.status} Body: ${body}`,
    );
  }

  const { access_token: accessToken } = JSON.parse(body);

  const userResponse = await fetch(`${config.issuerBaseUrl}/userInfo`, {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}` },
  });

  const userBody = await userResponse.text();

  if (userResponse.status !== 200) {
    return null;
  }

  return JSON.parse(userBody);
}

/**
 * Handler for updating the auth0UserId to superTokensUserId mapping within the users table of the Postgres database.
 * We do this via an HTTP call to our API service instead of directly connecting to the database here (in a serverless context).
 */
async function setUserIdMapping(
  config: Exclude<typeof env.auth.legacyAuth0, null>,
  params: { auth0UserId: string; supertokensUserId: string },
): Promise<void> {
  const response = await fetch(config.internalApi.endpoint + '/update_user_id_mapping', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-authorization': config.internalApi.apiKey,
    },
    body: JSON.stringify({
      auth0UserId: params.auth0UserId,
      superTokensUserId: params.supertokensUserId,
    }),
  });

  const body = await response.text();

  if (response.status !== 200) {
    throw new Error(`Failed to set user id mapping code. ${body}`);
  }
}

const CheckAuth0EmailUserExistsResponseModel = zod.object({
  user: zod.nullable(
    zod.object({ id: zod.string(), email: zod.string(), auth0UserId: zod.string() }),
  ),
});

/**
 * Check whether a specific user that SIGNED UP VIA EMAIL and password THAT DOES NOT YET EXIST IN SUPER TOKENS exists in the database as an Auth0 user.
 */
async function checkWhetherAuth0EmailUserWithoutAssociatedSuperTokensIdExists(
  config: Exclude<typeof env.auth.legacyAuth0, null>,
  params: { email: string },
): Promise<zod.TypeOf<typeof CheckAuth0EmailUserExistsResponseModel>['user']> {
  const response = await fetch(
    config.internalApi.endpoint + '/check_auth0_email_user_without_associated_supertoken_id_exists',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-authorization': config.internalApi.apiKey,
      },
      body: JSON.stringify({
        email: params.email,
      }),
    },
  );

  const body = await response.text();

  if (response.status !== 200) {
    throw new Error(
      `Failed to check whether the Auth0 email user without an associated supertokenId exists. Status: ${response.status}. Body: ${body}`,
    );
  }

  const { user } = CheckAuth0EmailUserExistsResponseModel.parse(JSON.parse(body));

  return user;
}

/**
 * Generate a Auth0 access token that is required for making API calls to Auth0.
 */
const generateAuth0AccessToken = async (
  config: Exclude<typeof env.auth.legacyAuth0, null>,
): Promise<string> => {
  const response = await fetch(`${config.issuerBaseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      audience: config.audience,
      grant_type: 'client_credentials',
    }),
  });

  const body = await response.text();

  if (response.status !== 200) {
    throw new Error(
      `Couldn't generate access token for Auth0. Status: ${response.status} Body: ${body}`,
    );
  }

  return JSON.parse(body).access_token;
};

async function generateRandomPassword(): Promise<string> {
  return await new Promise<string>((resolve, reject) =>
    crypto.randomBytes(20, (err, buf) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(buf.toString('hex'));
    }),
  );
}
