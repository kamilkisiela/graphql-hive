import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const assignMemberRole: NonNullable<MutationResolvers['assignMemberRole']> = async (
  _,
  { input },
  { injector },
) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

  const result = await injector.get(OrganizationManager).assignMemberRole({
    organizationId,
    userId: input.user,
    roleId: input.role,
  });

  if (result.ok) {
    const currentUser = await injector.get(AuthManager).getCurrentUser();
    injector.get(AuditLogManager).createLogAuditEvent(
      {
        eventType: 'ROLE_ASSIGNED',
        roleAssignedAuditLogSchema: {
          previousMemberRole: result.ok.previousMemberRole ? result.ok.previousMemberRole.id : null,
          roleId: input.role,
          updatedMember: result.ok.updatedMember.user.id,
          userIdAssigned: input.user,
        },
      },
      {
        organizationId: organizationId,
        userEmail: currentUser.email,
        userId: currentUser.id,
        user: currentUser,
      },
    );
  }

  return result;
};
