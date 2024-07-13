import { OidcIntegrationsModule } from './__generated__/types';
import { OIDCIntegrationsProvider } from './providers/oidc-integrations.provider';

export const resolvers: OidcIntegrationsModule.Resolvers = {
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
