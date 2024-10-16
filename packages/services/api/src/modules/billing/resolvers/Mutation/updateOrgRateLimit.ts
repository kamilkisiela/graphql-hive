import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { USAGE_DEFAULT_LIMITATIONS } from '../../constants';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateOrgRateLimit: NonNullable<MutationResolvers['updateOrgRateLimit']> = async (
  _,
  args,
  { injector },
) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId({
    organization: args.selector.organization,
  });

  const result = injector.get(OrganizationManager).updateRateLimits({
    organization: organizationId,
    monthlyRateLimit: {
      retentionInDays: USAGE_DEFAULT_LIMITATIONS.PRO.retention,
      operations: args.monthlyLimits.operations,
    },
  });

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'SUBSCRIPTION_UPDATED',
      subscriptionUpdatedAuditLogSchema: {
        updatedFields: JSON.stringify({
          monthlyRateLimit: {
            retentionInDays: USAGE_DEFAULT_LIMITATIONS.PRO.retention,
            operations: args.monthlyLimits.operations,
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

  return result;
};
