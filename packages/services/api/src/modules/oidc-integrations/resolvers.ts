import { OrganizationManager } from '../organization/providers/organization-manager';
import { OIDCIntegrationsProvider } from './providers/oidc-integrations.provider';
import { OidcIntegrationsModule } from './__generated__/types';

export const resolvers: OidcIntegrationsModule.Resolvers = {
  Mutation: {
    createOIDCIntegration: async (_, { input }, { injector }) => {
      const oktaIntegrationsProvider = injector.get(OIDCIntegrationsProvider);
      const result = await oktaIntegrationsProvider.createOIDCIntegrationForOrganization({
        organizationId: input.organizationId,
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        oauthApiUrl: input.oauthApiUrl,
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
            oauthApiUrl: result.fieldErrors?.oauthApiUrl,
          },
        },
      };
    },
    updateOIDCIntegration: async (_, { input }, { injector }) => {
      const oktaIntegrationsProvider = injector.get(OIDCIntegrationsProvider);
      const result = await oktaIntegrationsProvider.updateOIDCIntegration({
        oidcIntegrationId: input.oidcIntegrationId,
        clientId: input.clientId ?? null,
        clientSecret: input.clientSecret ?? null,
        oauthApiUrl: input.oauthApiUrl ?? null,
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
          },
        },
      };
    },
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
  },
  Organization: {
    viewerCanManageOIDCIntegration: (organization, _, { injector }) => {
      return injector.get(OIDCIntegrationsProvider).canViewerManageIntegrationForOrganization({
        organizationId: organization.id,
        organizationType: organization.type,
      });
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
    oauthApiUrl: oidcIntegration => oidcIntegration.oauthApiUrl,
    clientId: oidcIntegration => oidcIntegration.clientId,
    clientSecretPreview: (oidcIntegration, _, { injector }) =>
      injector.get(OIDCIntegrationsProvider).getClientSecretPreview(oidcIntegration),
  },
  User: {
    canSwitchOrganization: user => !!user.oidcIntegrationId,
  },
};
