import ThirdPartyEmailPasswordNode from 'supertokens-node/recipe/thirdpartyemailpassword';
import SessionNode from 'supertokens-node/recipe/session';
import type { TypeInput } from 'supertokens-node/types';
import type { TypeProvider } from 'supertokens-node/recipe/thirdparty/types';
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
    framework: 'express',
    supertokens: {
      connectionURI: process.env['SUPERTOKENS_CONNECTION_URI'],
      apiKey: process.env['SUPERTOKENS_API_KEY'],
    },
    appInfo,
    recipeList: [
      ThirdPartyEmailPasswordNode.init({
        override:
          process.env['NEXT_PUBLIC_APP_BASE_URL_AUTH_LEGACY_AUTH0'] === '1'
            ? {
                functions(originalImplementation) {
                  return {
                    ...originalImplementation,
                    async emailPasswordSignIn(input) {
                      // does user exist in auth0?
                      if (await doesUserExistInAuth0(input.email)) {
                        // check if user exists in SuperTokens
                        const superTokensUsers = await this.getUsersByEmail({
                          email: input.email,
                          userContext: input.userContext,
                        });
                        let emailPasswordUser = undefined;

                        for (let i = 0; i < superTokensUsers.length; i++) {
                          // if the thirdParty field in the user object is undefined, then the user is an EmailPassword account.
                          if (superTokensUsers[i].thirdParty === undefined) {
                            emailPasswordUser = superTokensUsers[i];
                            break;
                          }
                        }

                        if (emailPasswordUser === undefined) {
                          // EmailPassword user does not exist in SuperTokens

                          // Box 6: validate users credentials in Auth0
                          const auth0UserData = await validateAndGetUserInfoFromAuth0(input.email, input.password);

                          if (auth0UserData === null) {
                            // Box 9: credentials are incorrect
                            return {
                              status: 'WRONG_CREDENTIALS_ERROR',
                            };
                          }

                          // Box 7: call the signup function to create a new SuperTokens user.
                          const response = await this.emailPasswordSignUp(input);

                          if (response.status !== 'OK') {
                            return {
                              status: 'WRONG_CREDENTIALS_ERROR',
                            };
                          }

                          // Box 8: map the Auth0 userId to the SuperTokens userId, to learn more about user mapping please check the User Id  Mapping section.
                          // If you have not stored the users Auth0 userId in your tables, you can ignore this step
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
                      // Box 2: Get userInfo from Auth0 with Social Provider id.
                      const auth0UserInfo = await getThirdPartyUserFromAuth0(input.thirdPartyUserId);
                      // Box 3: check if userInfo exists
                      if (auth0UserInfo !== undefined) {
                        // Box 4: call the Supertokens signInUp implementation
                        const response = await originalImplementation.thirdPartySignInUp(input);
                        if (response.status !== 'OK') {
                          return response;
                        }

                        // Box 5: check if a new SuperTokens user is created
                        if (response.createdNewUser) {
                          await setUserIdMapping({
                            auth0UserId: auth0UserInfo.user_id,
                            supertokensUserId: response.user.id,
                          });

                          // Box 7: Set the newly created flag value to false in the response
                          response.createdNewUser = false;
                        }

                        return response;
                      }
                      // Box 9: Auth0 user does not exist
                      return await originalImplementation.thirdPartySignInUp(input);
                    },
                  };
                },
              }
            : undefined,
        providers,
      }),
      SessionNode.init({
        override: {
          functions: originalImplementation => {
            return {
              ...originalImplementation,
              createNewSession: async function (input) {
                const user = await ThirdPartyEmailPasswordNode.getUserById(input.userId);

                if (!user) {
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

async function doesUserExistInAuth0(email: string): Promise<boolean> {
  // generate an access token to use the Auth0's Management API.
  const access_token = await generateAccessToken();

  // check if a user exists with the input email and is not a Social Account
  const response = await fetch(
    `${process.env.AUTH_LEGACY_AUTH0_AUDIENCE}users?q=${encodeURIComponent(
      `identities.isSocial:false AND email:${email}`
    )}`,
    {
      method: 'GET',
      headers: { authorization: `Bearer ${access_token}` },
    }
  ).then(res => res.json());

  if (response[0] !== undefined) {
    return true;
  }
  return false;
}

async function validateAndGetUserInfoFromAuth0(email: string, password: string): Promise<{ sub: string } | null> {
  let accessToken: string;
  try {
    // generate an user access token using the input credentials
    accessToken = (
      await fetch(`${process.env['AUTH_LEGACY_AUTH0_ISSUER_BASE_URL']}/oauth/token`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env['AUTH_LEGACY_AUTH0_CLIENT_ID'],
          grant_type: 'password',
          username: email,
          password: password,
        }),
      }).then(res => res.json())
    ).data.access_token;
  } catch (error) {
    // input credentials are invalid
    return null;
  }
  const userResponse = await fetch(`${process.env['AUTH_LEGACY_AUTH0_ISSUER_BASE_URL']}/userInfo`, {
    method: 'GET',
    headers: { authorization: `Bearer ${accessToken}` },
  }).then(res => res.json());
  return userResponse.data;
}

async function setUserIdMapping(params: { auth0UserId: string; supertokensUserId: string }): Promise<void> {
  const response = await fetch(`http://localhost:4000/__legacy/update_user_id_mapping`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      auth0UserId: params.auth0UserId,
      superTokensUserId: params.supertokensUserId,
    }),
  });

  console.log(response.status, await response.text());
}

// Get the social account user info from Auth0 with the input thirdPartyId.
const getThirdPartyUserFromAuth0 = async (thirdPartyId: string) => {
  const access_token = await generateAccessToken();

  // send a request to Auth0's get user API with the input thirdPartyId as the search criteria.
  const response = await fetch(
    `${process.env['AUTH_LEGACY_AUTH0_AUDIENCE']}users?q=${encodeURIComponent(`identities.user_id:"${thirdPartyId}"`)}`,
    {
      method: 'GET',
      headers: { authorization: `Bearer ${access_token}` },
    }
  ).then(res => res.json());

  // check if user information exists in response.
  if (response[0] !== undefined) {
    // return the user's Auth0 userId
    return response[0];
  }

  return undefined;
};

const generateAccessToken = async (): Promise<string> => {
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
