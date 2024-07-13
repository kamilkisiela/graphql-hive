import { OIDCIntegrationsProvider } from '../../providers/oidc-integrations.provider';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateOIDCIntegration: NonNullable<
  MutationResolvers['updateOIDCIntegration']
> = async (_, { input }, { injector }) => {
  const oktaIntegrationsProvider = injector.get(OIDCIntegrationsProvider);
  const result = await oktaIntegrationsProvider.updateOIDCIntegration({
    oidcIntegrationId: input.oidcIntegrationId,
    clientId: input.clientId ?? null,
    clientSecret: input.clientSecret ?? null,
    tokenEndpoint: input.tokenEndpoint ?? null,
    userinfoEndpoint: input.userinfoEndpoint ?? null,
    authorizationEndpoint: input.authorizationEndpoint ?? null,
  });

  if (result.type === 'ok') {
    return {
      ok: {
        updatedOIDCIntegration: result.oidcIntegration,
      },
    };
  }

  return {
    error: {
      message: result.message,
      details: {
        clientId: result.fieldErrors?.clientId,
        clientSecret: result.fieldErrors?.clientSecret,
        oauthApiUrl: result.fieldErrors?.oauthApiUrl,
        tokenEndpoint: result.fieldErrors?.tokenEndpoint,
        userinfoEndpoint: result.fieldErrors?.userinfoEndpoint,
        authorizationEndpoint: result.fieldErrors?.authorizationEndpoint,
      },
    },
  };
};
