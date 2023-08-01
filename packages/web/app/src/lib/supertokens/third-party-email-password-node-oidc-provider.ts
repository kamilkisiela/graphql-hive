import { ExpressRequest } from 'supertokens-node/lib/build/framework/express/framework';
import { ProviderInput } from 'supertokens-node/recipe/thirdparty/types';
import ThirdPartyEmailPasswordNode from 'supertokens-node/recipe/thirdpartyemailpassword';
import { TypeInput as ThirdPartEmailPasswordTypeInput } from 'supertokens-node/recipe/thirdpartyemailpassword/types';
import zod from 'zod';
import { env } from '@/env/backend';
// eslint-disable-next-line import/no-extraneous-dependencies -- TODO: should we move to "dependencies"?
import { type InternalApi } from '@hive/server';
import { CreateTRPCProxyClient } from '@trpc/client';

const OIDCProfileInfoSchema = zod.object({
  sub: zod.string(),
  email: zod.string().email(),
});

const OIDCTokenSchema = zod.object({ access_token: zod.string() });

const createOIDCSuperTokensProvider = (oidcConfig: {
  id: string;
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  authorizationEndpoint: string;
}): ThirdPartyEmailPasswordNode.TypeProvider => ({
  id: 'oidc',
  get: (redirectURI, authCodeFromRequest) => ({
    getClientId: () => oidcConfig.clientId,
    getProfileInfo: async (rawTokenAPIResponse: unknown) => {
      const tokenResponse = OIDCTokenSchema.parse(rawTokenAPIResponse);
      const rawData: unknown = await fetch(oidcConfig.userinfoEndpoint, {
        headers: {
          authorization: `Bearer ${tokenResponse.access_token}`,
          accept: 'application/json',
          'content-type': 'application/json',
        },
      }).then(res => res.json());

      console.info(
        `getProfileInfo: fetched OIDC (${
          oidcConfig.userinfoEndpoint
        }) profile info: ${JSON.stringify(rawData)}`,
      );

      const data = OIDCProfileInfoSchema.parse(rawData);

      return {
        // We scope the user id to the oidc config id to avoid potential collisions
        id: `${oidcConfig.id}-${data.sub}`,
        email: {
          id: data.email,
          isVerified: true,
        },
      };
    },
    accessTokenAPI: {
      url: oidcConfig.tokenEndpoint,
      params: {
        client_id: oidcConfig.clientId,
        client_secret: oidcConfig.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectURI ?? '',
        code: authCodeFromRequest ?? '',
      },
    },
    authorisationRedirect: {
      // this contains info about forming the authorisation redirect URL without the state params and without the redirect_uri param
      url: oidcConfig.authorizationEndpoint,
      params: {
        client_id: oidcConfig.clientId,
        scope: 'openid email',
        response_type: 'code',
        redirect_uri: `${env.appBaseUrl}/auth/callback/oidc`,
        state: oidcConfig.id,
      },
    },
  }),
});

const getOIDCIdFromInput = (input: { userContext: any }): string => {
  const expressRequest = input.userContext._default.request as ExpressRequest;
  const originalUrl = 'http://localhost' + expressRequest.getOriginalURL();
  const oidcId = new URL(originalUrl).searchParams.get('oidc_id');

  if (typeof oidcId !== 'string') {
    throw new Error('Invalid OIDC ID sent from client.');
  }

  return oidcId;
};

export const getOIDCThirdPartyEmailPasswordNodeOverrides = (args: {
  internalApi: CreateTRPCProxyClient<InternalApi>;
}): ThirdPartEmailPasswordTypeInput['override'] => ({
  apis: originalImplementation => ({
    ...originalImplementation,
    thirdPartySignInUpPOST: async input => {
      if (input.provider.id !== 'oidc') {
        return originalImplementation.thirdPartySignInUpPOST!(input);
      }

      const oidcId = getOIDCIdFromInput(input);
      const config = await fetchOIDCConfig(args.internalApi, oidcId);

      return originalImplementation.thirdPartySignInUpPOST!({
        ...input,
        provider: createOIDCSuperTokensProvider(config),
        userContext: {
          ...input.userContext,
          oidcIntegrationId: oidcId,
        },
      });
    },
    authorisationUrlGET: async input => {
      if (input.provider.id !== 'oidc') {
        return originalImplementation.authorisationUrlGET!(input);
      }

      const oidcId = getOIDCIdFromInput(input);
      const config = await fetchOIDCConfig(args.internalApi, oidcId);

      const result = originalImplementation.authorisationUrlGET!({
        ...input,
        provider: createOIDCSuperTokensProvider(config),
      });

      return result;
    },
  }),
});

export const createOIDCSuperTokensNoopProvider = (): ProviderInput => ({
  config: {
    thirdPartyId: 'oidc',
  },
  // id: 'oidc',
  // get() {
  //   throw new Error('Provider implementation was not provided via overrides.');
  // },
});

const fetchOIDCConfig = async (
  internalApi: CreateTRPCProxyClient<InternalApi>,
  oidcIntegrationId: string,
): Promise<{
  id: string;
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  authorizationEndpoint: string;
}> => {
  const result = await internalApi.getOIDCIntegrationById.query({ oidcIntegrationId });
  if (result === null) {
    throw new Error('OIDC integration not found.');
  }
  return result;
};
