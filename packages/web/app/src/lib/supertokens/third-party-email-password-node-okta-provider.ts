import { ProviderInput } from 'supertokens-node/recipe/thirdparty/types';
import zod from 'zod';
import { env } from '@/env/backend';

type OktaConfig = Exclude<(typeof env)['auth']['okta'], null>;

/**
 * Custom (server) provider for SuperTokens in order to allow Okta users to sign in.
 */
export const createThirdPartyEmailPasswordNodeOktaProvider = (
  config: OktaConfig,
): ProviderInput => {
  return {
    config: {
      thirdPartyId: 'okta',
      name: 'Okta',
      clients: [
        {
          clientId: config.clientId,
          clientSecret: config.clientSecret,
        },
      ],

      authorizationEndpoint: `${config.endpoint}/oauth2/v1/authorize`,
      authorizationEndpointQueryParams: {
        scope: 'openid email profile okta.users.read.self',
      },

      tokenEndpoint: `${config.endpoint}/oauth2/v1/token`,
    },
    override(originalImplementation) {
      return {
        ...originalImplementation,
        async getUserInfo({ oAuthTokens }: { oAuthTokens: unknown }) {
          const data = OktaAccessTokenResponseModel.parse(oAuthTokens);
          const userData = await fetchOktaProfile(config, data.access_token);

          return {
            thirdPartyUserId: userData.id,
            email: {
              id: userData.profile.email,
              isVerified: true,
            },
            rawUserInfoFromProvider: {},
          };
        },
      };
    },
  };
};

const OktaAccessTokenResponseModel = zod.object({
  access_token: zod.string(),
});

const OktaProfileModel = zod.object({
  id: zod.string(),
  profile: zod.object({
    email: zod.string(),
  }),
});

const fetchOktaProfile = async (config: OktaConfig, accessToken: string) => {
  const response = await fetch(`${config.endpoint}/api/v1/users/me`, {
    method: 'GET',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status !== 200) {
    throw new Error(`Unexpected status code from Okta API: ${response.status}`);
  }

  const json = await response.json();
  return OktaProfileModel.parse(json);
};
