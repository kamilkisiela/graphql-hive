import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const leaveOrganization: NonNullable<MutationResolvers['leaveOrganization']> = async (
  _,
  { input },
  { injector },
) => {
  const translator = injector.get(IdTranslator);
  const organizationId = await translator.translateOrganizationId({
    organization: input.organization,
  });

  const result = await injector.get(OrganizationManager).leaveOrganization(organizationId);

  if (!result.ok) {
    return {
      error: {
        message: result.message,
      },
    };
  }

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'USER_REMOVED',
      userRemovedAuditLogSchema: {
        removedUserEmail: currentUser.email,
        removedUserId: currentUser.id,
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
    ok: {
      organizationId,
    },
  };
};
