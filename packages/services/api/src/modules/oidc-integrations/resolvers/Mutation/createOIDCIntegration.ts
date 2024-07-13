import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { OIDCIntegrationsProvider } from '../../providers/oidc-integrations.provider';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const createOIDCIntegration: NonNullable<
  MutationResolvers['createOIDCIntegration']
> = async (_, { input }, { injector }) => {
  const oktaIntegrationsProvider = injector.get(OIDCIntegrationsProvider);
  const result = await oktaIntegrationsProvider.createOIDCIntegrationForOrganization({
    organizationId: input.organizationId,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    tokenEndpoint: input.tokenEndpoint,
    userinfoEndpoint: input.userinfoEndpoint,
    authorizationEndpoint: input.authorizationEndpoint,
  });

  if (result.type === 'ok') {
    const organization = await injector
      .get(OrganizationManager)
      .getOrganization({ organization: input.organizationId });

    return {
      ok: {
        createdOIDCIntegration: result.oidcIntegration,
        organization,
      },
    };
  }

  return {
    error: {
      message: result.message ?? 'Failed to create OIDC Integration.',
      details: {
        clientId: result.fieldErrors?.clientId,
        clientSecret: result.fieldErrors?.clientSecret,
        tokenEndpoint: result.fieldErrors?.tokenEndpoint,
        userinfoEndpoint: result.fieldErrors?.userinfoEndpoint,
        authorizationEndpoint: result.fieldErrors?.authorizationEndpoint,
      },
    },
  };
};
