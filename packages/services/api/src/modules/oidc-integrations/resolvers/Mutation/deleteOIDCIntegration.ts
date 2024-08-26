import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
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
    const currentUser = await injector.get(AuthManager).getCurrentUser();
    injector.get(AuditLogManager).createLogAuditEvent(
      {
        eventType: 'ORGANIZATION_SETTINGS_UPDATED',
        organizationSettingsUpdatedAuditLogSchema: {
          updatedFields: JSON.stringify({
            oidc: {
              unregister: true,
            },
          }),
        },
      },
      {
        organizationId: result.organizationId,
        userEmail: currentUser.email,
        userId: currentUser.id,
        user: currentUser,
      },
    );

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
