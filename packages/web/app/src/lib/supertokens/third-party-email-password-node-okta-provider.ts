import type { TypeProvider } from 'supertokens-node/recipe/thirdpartyemailpassword';
// import zod from 'zod';
import { env } from '@/env/backend';

type OktaConfig = Exclude<(typeof env)['auth']['okta'], null>;

/**
 * Custom (server) provider for SuperTokens in order to allow Okta users to sign in.
 */
export const createThirdPartyEmailPasswordNodeOktaProvider = (
  _config: OktaConfig,
): TypeProvider => {
  return null as any;
  // {
  // id: 'okta',
  //   get(redirectURI, authCodeFromRequest) {
  //     return {
  //       accessTokenAPI: {
  //         // this contains info about the token endpoint which exchanges the auth code with the access token and profile info.
  //         url: `${config.endpoint}/oauth2/v1/token`,
  //         params: {
  //           // example post params
  //           client_id: config.clientId,
  //           client_secret: config.clientSecret,
  //           grant_type: 'authorization_code',
  //           redirect_uri: redirectURI || '',
  //           code: authCodeFromRequest || '',
  //         },
  //       },
  //       authorisationRedirect: {
  //         // this contains info about forming the authorisation redirect URL without the state params and without the redirect_uri param
  //         url: `${config.endpoint}/oauth2/v1/authorize`,
  //         params: {
  //           client_id: config.clientId,
  //           scope: 'openid email profile okta.users.read.self',
  //           response_type: 'code',
  //           redirect_uri: `${env.appBaseUrl}/auth/callback/okta`,
  //         },
  //       },
  //       getClientId: () => {
  //         return config.clientId;
  //       },
  //       getProfileInfo: async (accessTokenAPIResponse: unknown) => {
  //         const data = OktaAccessTokenResponseModel.parse(accessTokenAPIResponse);
  //         const userData = await fetchOktaProfile(config, data.access_token);
  //         return {
  //           id: userData.id,
  //           email: {
  //             id: userData.profile.email,
  //             isVerified: true,
  //           },
  //         };
  //       },
  //     };
  //   },
  // };
};

// const OktaAccessTokenResponseModel = zod.object({
//   access_token: zod.string(),
// });

// const OktaProfileModel = zod.object({
//   id: zod.string(),
//   profile: zod.object({
//     email: zod.string(),
//   }),
// });

// const fetchOktaProfile = async (config: OktaConfig, accessToken: string) => {
//   const response = await fetch(`${config.endpoint}/api/v1/users/me`, {
//     method: 'GET',
//     headers: {
//       'content-type': 'application/json',
//       accept: 'application/json',
//       authorization: `Bearer ${accessToken}`,
//     },
//   });

//   if (response.status !== 200) {
//     throw new Error(`Unexpected status code from Okta API: ${response.status}`);
//   }

//   const json = await response.json();
//   return OktaProfileModel.parse(json);
// };
