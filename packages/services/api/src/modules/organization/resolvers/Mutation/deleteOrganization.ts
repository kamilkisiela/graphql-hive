import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteOrganization: NonNullable<MutationResolvers['deleteOrganization']> = async (
  _,
  { selector },
  { injector },
) => {
  const translator = injector.get(IdTranslator);
  const organizationId = await translator.translateOrganizationId({
    organization: selector.organization,
  });
  const organization = await injector.get(OrganizationManager).deleteOrganization({
    organization: organizationId,
  });

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'ORGANIZATION_DELETED',
      organizationDeletedAuditLogSchema: {
        organizationId: organization.id,
      },
    },
    {
      organizationId: organization.id,
      userEmail: currentUser.email,
      userId: currentUser.id,
      user: currentUser,
    },
  );

  return {
    selector: {
      organization: organizationId,
    },
    organization,
  };
};
