import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { OIDCIntegrationsProvider } from '../../providers/oidc-integrations.provider';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteOIDCIntegration: NonNullable<
  MutationResolvers['deleteOIDCIntegration']
> = async (_, { input }, { injector }) => {
  const result = await injector
    .get(OIDCIntegrationsProvider)
    .deleteOIDCIntegration({ oidcIntegrationId: input.oidcIntegrationId });

  if (result.type === 'ok') {
    return {
      ok: {
        organization: await injector
          .get(OrganizationManager)
          .getOrganization({ organization: result.organizationId }),
      },
    };
  }

  return {
    error: {
      message: result.message,
    },
  };
};
