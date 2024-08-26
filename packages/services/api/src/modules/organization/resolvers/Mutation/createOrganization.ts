import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { OrganizationManager } from '../../providers/organization-manager';
import { OrganizationNameModel } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const createOrganization: NonNullable<MutationResolvers['createOrganization']> = async (
  _,
  { input },
  { injector },
) => {
  const organizationNameResult = OrganizationNameModel.safeParse(input.name.trim());
  if (!organizationNameResult.success) {
    return {
      error: {
        message: 'Please check your input.',
        inputErrors: {
          name: organizationNameResult.error.issues[0].message ?? null,
        },
      },
    };
  }

  const user = await injector.get(AuthManager).getCurrentUser();
  const organization = await injector.get(OrganizationManager).createOrganization({
    name: input.name,
    user,
  });

  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'ORGANIZATION_CREATED',
      organizationCreatedAuditLogSchema: {
        organizationId: organization.id,
        organizationName: organization.name,
      },
    },
    {
      organizationId: organization.id,
      userEmail: user.email,
      userId: user.id,
      user: user,
    },
  );

  return {
    ok: {
      createdOrganizationPayload: {
        selector: {
          organization: organization.cleanId,
        },
        organization,
      },
    },
  };
};
