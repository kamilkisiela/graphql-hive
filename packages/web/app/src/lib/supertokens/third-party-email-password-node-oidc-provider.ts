import zod from 'zod';
import ThirdPartyEmailPasswordNode from 'supertokens-node/recipe/thirdpartyemailpassword';
import type { TypeInput as ThirdPartEmailPasswordTypeInput } from 'supertokens-node/recipe/thirdpartyemailpassword/types';
import { env } from '@/env/backend';
import { ExpressRequest } from 'supertokens-node/lib/build/framework/express/framework';
import type { createTRPCClient } from '@trpc/client';
import type { InternalApi } from '@hive/server';

const OIDCProfileInfoSchema = zod.object({
  sub: zod.string(),
  email: zod.string().email(),
});

const OIDCTokenSchema = zod.object({ access_token: zod.string() });

const createOIDCSuperTokensProvider = (oidcConfig: {
  id: string;
  clientId: string;
  clientSecret: string;
  domain: string;
}): ThirdPartyEmailPasswordNode.TypeProvider => ({
  id: 'oidc',
  get: (redirectURI, authCodeFromRequest) => ({
    getClientId: () => {
      return oidcConfig.clientId;
    },
    getProfileInfo: async (rawTokenAPIResponse: unknown) => {
      const tokenResponse = OIDCTokenSchema.parse(rawTokenAPIResponse);
      const rawData: unknown = await fetch(oidcConfig.domain + '/userinfo', {
        headers: {
          authorization: `Bearer ${tokenResponse.access_token}`,
          accept: 'application/json',
          'content-type': 'application/json',
        },
      }).then(res => res.json());

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
      url: `${oidcConfig.domain}/token`,
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
      url: `${oidcConfig.domain}/authorize`,
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
  internalApi: ReturnType<typeof createTRPCClient<InternalApi>>;
}): ThirdPartEmailPasswordTypeInput['override'] => ({
  apis: originalImplementation => ({
    ...originalImplementation,
    thirdPartySignInUpPOST: async input => {
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

export const createOIDCSuperTokensNoopProvider = () => ({
  id: 'oidc',
  get: () => {
    throw new Error('Provider implementation was not provided via overrides.');
  },
});

const fetchOIDCConfig = async (
  internalApi: ReturnType<typeof createTRPCClient<InternalApi>>,
  oidcIntegrationId: string
): Promise<{ id: string; clientId: string; clientSecret: string; domain: string }> => {
  const result = await internalApi.query('getOIDCIntegrationById', { oidcIntegrationId });
  if (result === null) {
    throw new Error('OIDC integration not found.');
  }
  return result;
};
