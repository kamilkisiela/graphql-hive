import { OidcIntegrationsModule } from './__generated__/types';
import { OIDCIntegrationsProvider } from './providers/oidc-integrations.provider';

export const resolvers: OidcIntegrationsModule.Resolvers = {
  Organization: {
    viewerCanManageOIDCIntegration: (organization, _, { injector }) => {
      return injector
        .get(OIDCIntegrationsProvider)
        .canViewerManageIntegrationForOrganization(organization.id);
    },
    oidcIntegration: async (organization, _, { injector }) => {
      if (injector.get(OIDCIntegrationsProvider).isEnabled() === false) {
        return null;
      }

      return await injector
        .get(OIDCIntegrationsProvider)
        .getOIDCIntegrationForOrganization({ organizationId: organization.id });
    },
  },
  OIDCIntegration: {
    id: oidcIntegration => oidcIntegration.id,
    tokenEndpoint: oidcIntegration => oidcIntegration.tokenEndpoint,
    userinfoEndpoint: oidcIntegration => oidcIntegration.userinfoEndpoint,
    authorizationEndpoint: oidcIntegration => oidcIntegration.authorizationEndpoint,
    clientId: oidcIntegration => oidcIntegration.clientId,
    clientSecretPreview: (oidcIntegration, _, { injector }) =>
      injector.get(OIDCIntegrationsProvider).getClientSecretPreview(oidcIntegration),
  },
  User: {
    canSwitchOrganization: user => !user.oidcIntegrationId,
  },
};
