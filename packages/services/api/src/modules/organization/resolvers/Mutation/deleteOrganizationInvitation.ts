import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteOrganizationInvitation: NonNullable<
  MutationResolvers['deleteOrganizationInvitation']
> = async (_, { input }, { injector }) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);
  const invitation = await injector
    .get(OrganizationManager)
    .deleteInvitation({ organization: organizationId, email: input.email });

  if (invitation) {
    const currentUser = await injector.get(AuthManager).getCurrentUser();
    injector.get(AuditLogManager).createLogAuditEvent(
      {
        eventType: 'ORGANIZATION_SETTINGS_UPDATED',
        organizationSettingsUpdatedAuditLogSchema: {
          updatedFields: JSON.stringify({
            invitations: {
              deleted: [input.email],
            },
          }),
        },
      },
      {
        organizationId: organizationId,
        userEmail: currentUser.email,
        userId: currentUser.id,
        user: currentUser,
      },
    );

    return {
      ok: invitation,
    };
  }

  return {
    error: {
      message: 'Invitation not found',
    },
  };
};
