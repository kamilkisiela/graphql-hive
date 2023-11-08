import type { ExpressRequest } from 'supertokens-node/lib/build/framework/express/framework';
import type { ProviderInput } from 'supertokens-node/recipe/thirdparty/types';
import zod from 'zod';
import { getLogger } from '@/server-logger';
// eslint-disable-next-line import/no-extraneous-dependencies -- TODO: should we move to "dependencies"?
import { type InternalApi } from '@hive/server';
import { CreateTRPCProxyClient } from '@trpc/client';

const OIDCProfileInfoSchema = zod.object({
  sub: zod.string(),
  email: zod.string().email(),
});

const OIDCTokenSchema = zod.object({ access_token: zod.string() });

const getOIDCIdFromInput = (input: { userContext: any }): string => {
  const expressRequest = input.userContext._default.request as ExpressRequest;
  const originalUrl = 'http://localhost' + expressRequest.getOriginalURL();
  const oidcId = new URL(originalUrl).searchParams.get('oidc_id');

  if (typeof oidcId !== 'string') {
    const logger = getLogger();
    logger.error('Invalid OIDC ID sent from client: %s', oidcId);
    throw new Error('Invalid OIDC ID sent from client.');
  }

  return oidcId;
};

export const createOIDCSuperTokensProvider = (args: {
  internalApi: CreateTRPCProxyClient<InternalApi>;
}): ProviderInput => ({
  config: {
    thirdPartyId: 'oidc',
  },
  override(originalImplementation) {
    const logger = getLogger();
    return {
      ...originalImplementation,

      async getConfigForClientType(input) {
        logger.info('resolve config for OIDC provider.');
        const oidcId = getOIDCIdFromInput(input);
        const config = await fetchOIDCConfig(args.internalApi, oidcId);
        if (!config) {
          logger.error('Could not find OIDC integration (oidcId: %s)', oidcId);
          throw new Error('Could not find OIDC integration.');
        }

        return {
          thirdPartyId: 'oidc',
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          authorizationEndpoint: config.authorizationEndpoint,
          userInfoEndpoint: config.userinfoEndpoint,
          tokenEndpoint: config.tokenEndpoint,
          scope: ['openid', 'email'],
        };
      },

      async getAuthorisationRedirectURL(input) {
        logger.info('resolve config for OIDC provider.');
        const oidcId = getOIDCIdFromInput(input);
        const oidcConfig = await fetchOIDCConfig(args.internalApi, oidcId);
        if (!oidcConfig) {
          logger.error('Could not find OIDC integration (oidcId: %s)', oidcId);
          throw new Error('Could not find OIDC integration.');
        }

        const authorizationRedirectUrl =
          await originalImplementation.getAuthorisationRedirectURL(input);

        const url = new URL(authorizationRedirectUrl.urlWithQueryParams);
        url.searchParams.set('state', oidcConfig.id);

        return {
          ...authorizationRedirectUrl,
          urlWithQueryParams: url.toString(),
        };
      },

      async getUserInfo(input) {
        logger.info('retrieve profile info from OIDC provider');
        const oidcId = getOIDCIdFromInput(input);
        const config = await fetchOIDCConfig(args.internalApi, oidcId);

        if (!config) {
          logger.error('Could not find OIDC integration (oidcId: %s)', oidcId);
          throw new Error('Could not find OIDC integration.');
        }

        const tokenResponse = OIDCTokenSchema.parse(input.oAuthTokens);
        const rawData: unknown = await fetch(config.userinfoEndpoint, {
          headers: {
            authorization: `Bearer ${tokenResponse.access_token}`,
            accept: 'application/json',
            'content-type': 'application/json',
          },
        }).then(res => res.json());

        logger.info(
          `getProfileInfo: fetched OIDC (${config.userinfoEndpoint}) profile info: ${JSON.stringify(
            rawData,
          )}`,
        );

        const data = OIDCProfileInfoSchema.parse(rawData);

        return {
          thirdPartyUserId: `${config.id}-${data.sub}`,
          email: {
            id: data.email,
            isVerified: true,
          },
          rawUserInfoFromProvider: {
            fromIdTokenPayload: undefined,
            fromUserInfoAPI: undefined,
          },
        };
      },
    };
  },
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
} | null> => {
  const result = await internalApi.getOIDCIntegrationById.query({ oidcIntegrationId });
  if (result === null) {
    const logger = getLogger();
    logger.error('OIDC integration not found. (oidcId=%s)', oidcIntegrationId);
    return null;
  }
  return result;
};
