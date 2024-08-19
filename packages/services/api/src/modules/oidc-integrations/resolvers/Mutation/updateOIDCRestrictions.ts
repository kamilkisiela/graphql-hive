import { OIDCIntegrationsProvider } from '../../providers/oidc-integrations.provider';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateOIDCRestrictions: NonNullable<
  MutationResolvers['updateOIDCRestrictions']
> = async (_, { input }, { injector }) => {
  const result = await injector.get(OIDCIntegrationsProvider).updateOIDCRestrictions({
    oidcIntegrationId: input.oidcIntegrationId,
    oidcUserAccessOnly: input.oidcUserAccessOnly,
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
    },
  };
};
