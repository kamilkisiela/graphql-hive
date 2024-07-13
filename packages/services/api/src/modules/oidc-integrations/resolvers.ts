import { OidcIntegrationsModule } from './__generated__/types';

export const resolvers: OidcIntegrationsModule.Resolvers = {
  User: {
    canSwitchOrganization: user => !user.oidcIntegrationId,
  },
};
