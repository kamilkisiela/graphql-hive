import type { ExpressRequest } from 'supertokens-node/lib/build/framework/express/framework';
import type { ProviderInput } from 'supertokens-node/recipe/thirdparty/types';
import type { TypeInput as ThirdPartEmailPasswordTypeInput } from 'supertokens-node/recipe/thirdpartyemailpassword/types';
import zod from 'zod';
import { getLogger } from '@/server-logger';
import type { InternalApi } from '@hive/server';
import type { CreateTRPCProxyClient } from '@trpc/client';

const couldNotResolveOidcIntegrationSymbol = Symbol('could_not_resolve_oidc_integration');

export const getOIDCSuperTokensOverrides = (): ThirdPartEmailPasswordTypeInput['override'] => ({
  apis(originalImplementation) {
    return {
      ...originalImplementation,
      async authorisationUrlGET(input) {
        if (input.userContext?.[couldNotResolveOidcIntegrationSymbol] === true) {
          return {
            status: 'GENERAL_ERROR',
            message: 'Could not find OIDC integration.',
          };
        }

        return originalImplementation.authorisationUrlGET!(input);
      },
    };
  },
});

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
        const config = await getOIDCConfigFromInput(args.internalApi, input);
        if (!config) {
          // In the next step the override `authorisationUrlGET` from `getOIDCSuperTokensOverrides` is called.
          // We use the user context to return a `GENERAL_ERROR` with a human readable message.
          // We cannot return an error here (except an "Unexpected error"), so we also need to return fake dat
          input.userContext[couldNotResolveOidcIntegrationSymbol] = true;

          return {
            thirdPartyId: 'oidc',
            get clientId(): string {
              throw new Error('Noop value accessed.');
            },
          };
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
        const oidcConfig = await getOIDCConfigFromInput(args.internalApi, input);

        if (!oidcConfig) {
          // This case should never be reached (guarded by getConfigForClientType).
          // We still have it for security reasons.
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
        const config = await getOIDCConfigFromInput(args.internalApi, input);
        if (!config) {
          // This case should never be reached (guarded by getConfigForClientType).
          // We still have it for security reasons.
          throw new Error('Could not find OIDC integration.');
        }

        logger.info('fetch info for OIDC provider (oidcId=%s)', config.id);

        const tokenResponse = OIDCTokenSchema.parse(input.oAuthTokens);
        const rawData: unknown = await fetch(config.userinfoEndpoint, {
          headers: {
            authorization: `Bearer ${tokenResponse.access_token}`,
            accept: 'application/json',
            'content-type': 'application/json',
          },
        }).then(res => res.json());

        logger.info('retrieved profile info for provider (oidcId=%s)', config.id);

        const data = OIDCProfileInfoSchema.parse(rawData);

        // Set the oidcId to the user context so it can be used in `thirdPartySignInUpPOST` for linking the user account to the OIDC integration.
        input.userContext.oidcId = config.id;

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

type OIDCCOnfig = {
  id: string;
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  authorizationEndpoint: string;
};

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

const configCache = new WeakMap<ExpressRequest, OIDCCOnfig | null>();

/**
 * Get cached OIDC config from the supertokens input.
 */
async function getOIDCConfigFromInput(
  internalApi: CreateTRPCProxyClient<InternalApi>,
  input: { userContext: any },
) {
  const expressRequest = input.userContext._default.request as ExpressRequest;
  if (configCache.has(expressRequest)) {
    return configCache.get(expressRequest) ?? null;
  }

  const oidcId = getOIDCIdFromInput(input);
  const config = await fetchOIDCConfig(internalApi, oidcId);
  configCache.set(expressRequest, config);
  if (!config) {
    const logger = getLogger();
    logger.error('Could not find OIDC integration (oidcId: %s)', oidcId);
  }
  return config;
}

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
