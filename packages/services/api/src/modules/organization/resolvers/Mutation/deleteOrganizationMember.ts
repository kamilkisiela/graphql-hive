import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteOrganizationMember: NonNullable<
  MutationResolvers['deleteOrganizationMember']
> = async (_, { input }, { injector }) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);
  const organization = await injector
    .get(OrganizationManager)
    .deleteMember({ organization: organizationId, user: input.user });

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'ORGANIZATION_SETTINGS_UPDATED',
      organizationSettingsUpdatedAuditLogSchema: {
        updatedFields: JSON.stringify({
          members: {
            deleted: [input.user],
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
    selector: input,
    organization,
  };
};
