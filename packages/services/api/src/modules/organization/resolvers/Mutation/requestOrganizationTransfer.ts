import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const requestOrganizationTransfer: NonNullable<
  MutationResolvers['requestOrganizationTransfer']
> = async (_, { input }, { injector }) => {
  const organization = await injector.get(IdTranslator).translateOrganizationId(input);
  const result = await injector.get(OrganizationManager).requestOwnershipTransfer({
    organization,
    user: input.user,
  });

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'ORGANIZATION_TRANSFERRED_REQUEST',
      organizationTransferredRequestAuditLogSchema: {
        newOwnerEmail: result.ok ? result.ok.email : null,
        newOwnerId: input.user,
      },
    },
    {
      organizationId: organization,
      userEmail: currentUser.email,
      userId: currentUser.id,
      user: currentUser,
    },
  );

  return result;
};
