import { OIDCIntegrationsProvider } from '../providers/oidc-integrations.provider';
import type { OidcIntegrationResolvers } from './../../../__generated__/types.next';

export const OIDCIntegration: OidcIntegrationResolvers = {
  id: oidcIntegration => oidcIntegration.id,
  tokenEndpoint: oidcIntegration => oidcIntegration.tokenEndpoint,
  userinfoEndpoint: oidcIntegration => oidcIntegration.userinfoEndpoint,
  authorizationEndpoint: oidcIntegration => oidcIntegration.authorizationEndpoint,
  clientId: oidcIntegration => oidcIntegration.clientId,
  clientSecretPreview: (oidcIntegration, _, { injector }) =>
    injector.get(OIDCIntegrationsProvider).getClientSecretPreview(oidcIntegration),
};
