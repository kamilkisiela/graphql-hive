import ThirdPartyEmailPasswordNode from 'supertokens-node/recipe/thirdpartyemailpassword';
import SessionNode from 'supertokens-node/recipe/session';
import type { TypeInput } from 'supertokens-node/types';
import type { TypeProvider } from 'supertokens-node/recipe/thirdparty/types';
import type { TypeInput as ThirdPartEmailPasswordTypeInput } from 'supertokens-node/recipe/thirdpartyemailpassword/types';
import { fetch } from 'cross-undici-fetch';
import { appInfo } from './app-info';

export const backendConfig = (): TypeInput => {
  const providers: Array<TypeProvider> = [];

  if (process.env['NEXT_PUBLIC_APP_BASE_URL_AUTH_GITHUB'] === '1') {
    if (!process.env['AUTH_GITHUB_CLIENT_ID'] || !process.env['AUTH_GITHUB_CLIENT_SECRET']) {
      throw new Error('Insufficient GitHub configuration.');
    }
    providers.push(
      ThirdPartyEmailPasswordNode.Github({
        clientId: process.env['AUTH_GITHUB_CLIENT_ID'],
        clientSecret: process.env['AUTH_GITHUB_CLIENT_SECRET'],
      })
    );
  }
  if (process.env['NEXT_PUBLIC_APP_BASE_URL_AUTH_GOOGLE'] === '1') {
    if (!process.env['AUTH_GOOGLE_CLIENT_ID'] || !process.env['AUTH_GOOGLE_CLIENT_SECRET']) {
      throw new Error('Insufficient GitHub configuration.');
    }
    providers.push(
      ThirdPartyEmailPasswordNode.Google({
        clientId: process.env['AUTH_GOOGLE_CLIENT_ID'],
        clientSecret: process.env['AUTH_GOOGLE_CLIENT_SECRET'],
      })
    );
  }

  return {
    supertokens: {
      connectionURI: process.env['SUPERTOKENS_CONNECTION_URI'],
      apiKey: process.env['SUPERTOKENS_API_KEY'],
    },
    appInfo,
    recipeList: [
      ThirdPartyEmailPasswordNode.init({
        providers,
        override:
          /**
           * These overrides are only relevant for the legacy Auth0 -> SuperTokens migration (period).
           */
          process.env['NEXT_PUBLIC_APP_BASE_URL_AUTH_LEGACY_AUTH0'] === '1' ? getAuth0Overrides() : undefined,
      }),
      SessionNode.init({
        override: {
          functions: originalImplementation => {
            return {
              ...originalImplementation,
              createNewSession: async function (input) {
                const user = await ThirdPartyEmailPasswordNode.getUserById(input.userId);

                if (!user) {
                  // TODO: better error handling
                  throw new Error('Could not find user??');
                }

                // This is stored in the db against the sessionHandle for this session
                input.accessTokenPayload = {
                  version: '1',
                  superTokensUserId: input.userId,
                  email: user.email,
                };

                input.sessionData = {
                  version: '1',
                  superTokensUserId: input.userId,
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

const getAuth0Overrides = () => {
  const override: ThirdPartEmailPasswordTypeInput['override'] = {
    functions(originalImplementation) {
      return {
        ...originalImplementation,
        async emailPasswordSignIn(input) {
          if (await doesUserExistInAuth0(input.email)) {
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

              // We also set the 'supertokensUserId' on the users table within our database.
              await setUserIdMapping({
                auth0UserId: auth0UserData.sub,
                supertokensUserId: response.user.id,
              });

              return response;
            }
          }

          return originalImplementation.emailPasswordSignIn(input);
        },
        async thirdPartySignInUp(input) {
          // Check whether third party user exists on Auth0
          const auth0UserInfo = await getThirdPartyUserFromAuth0(input.thirdPartyUserId);
          // Sign up the user with SuperTokens.
          const response = await originalImplementation.thirdPartySignInUp(input);

          // Auth0 user exists
          if (auth0UserInfo && response.status === 'OK') {
            // We always make sure that we set the user mapping between Auth0 and SuperTokens.
            await setUserIdMapping({
              auth0UserId: auth0UserInfo.user_id,
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
async function doesUserExistInAuth0(email: string): Promise<boolean> {
  const access_token = await generateAuth0AccessToken();

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
  email: string,
  password: string
): Promise<{ sub: string } | null> {
  // generate an user access token using the input credentials
  const response = await fetch(`${process.env['AUTH_LEGACY_AUTH0_ISSUER_BASE_URL']}/oauth/token`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env['AUTH_LEGACY_AUTH0_CLIENT_ID'],
      client_secret: process.env['AUTH_LEGACY_AUTH0_CLIENT_SECRET'],
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
async function setUserIdMapping(params: { auth0UserId: string; supertokensUserId: string }): Promise<void> {
  const response = await fetch(`${process.env.API_ENDPOINT}/__legacy/update_user_id_mapping`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
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
 * Get the social account user info from Auth0 via the third party user id.
 * The third party user id is unique per GitHub or Google user and is the same whether you are signed up on Auth0 or SuperTokens.
 */
const getThirdPartyUserFromAuth0 = async (thirdPartyId: string): Promise<null | { user_id: string }> => {
  const access_token = await generateAuth0AccessToken();

  const response = await fetch(
    `${process.env['AUTH_LEGACY_AUTH0_AUDIENCE']}users?q=${encodeURIComponent(`identities.user_id:"${thirdPartyId}"`)}`,
    {
      method: 'GET',
      headers: { authorization: `Bearer ${access_token}` },
    }
  );

  const rawBody = await response.text();
  if (response.status !== 200) {
    throw new Error('Failed to retreive the third party user info from Auth0.\n' + rawBody);
  }

  const body = JSON.parse(rawBody);

  // check if user information exists in response.
  if (body[0]) {
    // return the user's Auth0 userId
    return body[0];
  }

  return null;
};

/**
 * Generate a Auth0 access token that is required for making API calls to Auth0.
 */
const generateAuth0AccessToken = async (): Promise<string> => {
  const response = await fetch(`${process.env['AUTH_LEGACY_AUTH0_ISSUER_BASE_URL']}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env['AUTH_LEGACY_AUTH0_CLIENT_ID'],
      client_secret: process.env['AUTH_LEGACY_AUTH0_CLIENT_SECRET'],
      audience: process.env['AUTH_LEGACY_AUTH0_AUDIENCE'],
      grant_type: 'client_credentials',
    }),
  }).then(res => res.json());

  return response.access_token;
};
