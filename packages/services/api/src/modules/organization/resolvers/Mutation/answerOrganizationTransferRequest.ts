import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { Logger } from '../../../shared/providers/logger';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const answerOrganizationTransferRequest: NonNullable<
  MutationResolvers['answerOrganizationTransferRequest']
> = async (_, { input }, { injector }) => {
  const organization = await injector.get(IdTranslator).translateOrganizationId(input);

  try {
    await injector.get(OrganizationManager).answerOwnershipTransferRequest({
      organization,
      code: input.code,
      accept: input.accept,
    });

    const currentUser = await injector.get(AuthManager).getCurrentUser();
    injector.get(AuditLogManager).createLogAuditEvent(
      {
        eventType: 'ORGANIZATION_TRANSFERRED',
        organizationTransferredAuditLogSchema: {
          newOwnerEmail: currentUser.email,
          newOwnerId: currentUser.id,
        },
      },
      {
        organizationId: organization,
        userEmail: currentUser.email,
        userId: currentUser.id,
        user: currentUser,
      },
    );

    return {
      ok: {
        accepted: input.accept,
      },
    };
  } catch (error) {
    injector.get(Logger).error(error as any);

    return {
      error: {
        message: 'Failed to answer the request',
      },
    };
  }
};
