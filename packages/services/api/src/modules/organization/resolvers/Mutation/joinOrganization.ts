import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { OrganizationManager } from '../../providers/organization-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const joinOrganization: NonNullable<MutationResolvers['joinOrganization']> = async (
  _,
  { code },
  { injector },
) => {
  const organization = await injector.get(OrganizationManager).joinOrganization({ code });

  if ('message' in organization) {
    return organization;
  }

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'USER_JOINED',
      userJoinedAuditLogSchema: {
        inviteeEmail: currentUser.email,
        inviteeId: currentUser.id,
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
    __typename: 'OrganizationPayload',
    selector: {
      organization: organization.cleanId,
    },
    organization,
  };
};
