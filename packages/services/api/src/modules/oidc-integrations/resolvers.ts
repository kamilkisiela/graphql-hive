import { OrganizationManager } from '../organization/providers/organization-manager';
import { OidcIntegrationsModule } from './__generated__/types';
import { OIDCIntegrationsProvider } from './providers/oidc-integrations.provider';

export const resolvers: OidcIntegrationsModule.Resolvers = {
  Mutation: {
    deleteOIDCIntegration: async (_, { input }, { injector }) => {
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
    },
    async updateOIDCRestrictions(_, { input }, { injector }) {
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
    },
  },
  Subscription: {
    oidcIntegrationLog: {
      subscribe: (_, args, { injector }) =>
        injector
          .get(OIDCIntegrationsProvider)
          .subscribeToOIDCIntegrationLogs({ oidcIntegrationId: args.input.oidcIntegrationId }),
      resolve: (payload: { message: string; timestamp: string }) => payload,
    },
  },
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
