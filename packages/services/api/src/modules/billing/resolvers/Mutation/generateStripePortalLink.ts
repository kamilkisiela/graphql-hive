import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { OrganizationAccessScope } from '../../../auth/providers/organization-access';
import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { BillingProvider } from '../../providers/billing.provider';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const generateStripePortalLink: NonNullable<
  MutationResolvers['generateStripePortalLink']
> = async (_, args, { injector }) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId({
    organization: args.selector.organization,
  });
  const organization = await injector.get(OrganizationManager).getOrganization(
    {
      organization: organizationId,
    },
    OrganizationAccessScope.SETTINGS,
  );

  const result = injector.get(BillingProvider).generateStripePortalLink(organization.id);

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'SUBSCRIPTION_UPDATED',
      subscriptionUpdatedAuditLogSchema: {
        updatedFields: JSON.stringify({
          generateStripePortalLink: true,
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
