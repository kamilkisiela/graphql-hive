import type { FastifyRequest } from 'supertokens-node/lib/build/framework/fastify/framework';
import type { ProviderInput } from 'supertokens-node/recipe/thirdparty/types';
import type { TypeInput as ThirdPartEmailPasswordTypeInput } from 'supertokens-node/recipe/thirdpartyemailpassword/types';
import zod from 'zod';
import { createInternalApiCaller } from '../api';

const couldNotResolveOidcIntegrationSymbol = Symbol('could_not_resolve_oidc_integration');

type InternalApiCaller = ReturnType<typeof createInternalApiCaller>;

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
  internalApi: InternalApiCaller;
}): ProviderInput => ({
  config: {
    thirdPartyId: 'oidc',
  },
  override(originalImplementation) {
    return {
      ...originalImplementation,

      async getConfigForClientType(input) {
        console.info('resolve config for OIDC provider.');
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
        console.info('resolve config for OIDC provider.');
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
        console.info('retrieve profile info from OIDC provider');
        const config = await getOIDCConfigFromInput(args.internalApi, input);
        if (!config) {
          // This case should never be reached (guarded by getConfigForClientType).
          // We still have it for security reasons.
          throw new Error('Could not find OIDC integration.');
        }

        console.info('fetch info for OIDC provider (oidcId=%s)', config.id);

        const tokenResponse = OIDCTokenSchema.parse(input.oAuthTokens);
        const rawData: unknown = await fetch(config.userinfoEndpoint, {
          headers: {
            authorization: `Bearer ${tokenResponse.access_token}`,
            accept: 'application/json',
            'content-type': 'application/json',
          },
        }).then(res => res.json());

        console.info('retrieved profile info for provider (oidcId=%s)', config.id);

        const dataParseResult = OIDCProfileInfoSchema.safeParse(rawData);

        if (!dataParseResult.success) {
          console.error('Could not parse profile info for OIDC provider (oidcId=%s)', config.id);
          console.error('Raw data: %s', JSON.stringify(rawData));
          console.error('Error: %s', JSON.stringify(dataParseResult.error));
          for (const issue of dataParseResult.error.issues) {
            console.debug('Issue: %s', JSON.stringify(issue));
          }
          throw new Error('Could not parse profile info.');
        }

        const profile = dataParseResult.data;

        // Set the oidcId to the user context so it can be used in `thirdPartySignInUpPOST` for linking the user account to the OIDC integration.
        input.userContext.oidcId = config.id;

        return {
          thirdPartyUserId: `${config.id}-${profile.sub}`,
          email: {
            id: profile.email,
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
  const fastifyRequest = input.userContext._default.request as FastifyRequest;
  const originalUrl = 'http://localhost' + fastifyRequest.getOriginalURL();
  const oidcId = new URL(originalUrl).searchParams.get('oidc_id');

  if (typeof oidcId !== 'string') {
    console.error('Invalid OIDC ID sent from client: %s', oidcId);
    throw new Error('Invalid OIDC ID sent from client.');
  }

  return oidcId;
};

const configCache = new WeakMap<FastifyRequest, OIDCCOnfig | null>();

/**
 * Get cached OIDC config from the supertokens input.
 */
async function getOIDCConfigFromInput(internalApi: InternalApiCaller, input: { userContext: any }) {
  const fastifyRequest = input.userContext._default.request as FastifyRequest;
  if (configCache.has(fastifyRequest)) {
    return configCache.get(fastifyRequest) ?? null;
  }

  const oidcId = getOIDCIdFromInput(input);
  const config = await fetchOIDCConfig(internalApi, oidcId);
  configCache.set(fastifyRequest, config);
  if (!config) {
    console.error('Could not find OIDC integration (oidcId: %s)', oidcId);
  }
  return config;
}

const fetchOIDCConfig = async (
  internalApi: InternalApiCaller,
  oidcIntegrationId: string,
): Promise<{
  id: string;
  clientId: string;
  clientSecret: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  authorizationEndpoint: string;
} | null> => {
  const result = await internalApi.getOIDCIntegrationById({ oidcIntegrationId });
  if (result === null) {
    // TODO: replace console.error with req.log.error
    console.error('OIDC integration not found. (oidcId=%s)', oidcIntegrationId);
    return null;
  }
  return result;
};
