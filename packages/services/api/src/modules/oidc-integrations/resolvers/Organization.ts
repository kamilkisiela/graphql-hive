import { OIDCIntegrationsProvider } from '../providers/oidc-integrations.provider';
import type { OrganizationResolvers } from './../../../__generated__/types.next';

export const Organization: Pick<
  OrganizationResolvers,
  'oidcIntegration' | 'viewerCanManageOIDCIntegration' | '__isTypeOf'
> = {
  oidcIntegration: async (organization, _, { injector }) => {
    if (injector.get(OIDCIntegrationsProvider).isEnabled() === false) {
      return null;
    }

    return await injector
      .get(OIDCIntegrationsProvider)
      .getOIDCIntegrationForOrganization({ organizationId: organization.id });
  },
  viewerCanManageOIDCIntegration: async (organization, _, { injector }) => {
    return injector
      .get(OIDCIntegrationsProvider)
      .canViewerManageIntegrationForOrganization(organization.id);
  },
};
