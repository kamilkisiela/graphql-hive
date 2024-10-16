import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import { OrganizationNameModel } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateOrganizationName: NonNullable<
  MutationResolvers['updateOrganizationName']
> = async (_, { input }, { injector }) => {
  const result = OrganizationNameModel.safeParse(input.name?.trim());

  if (!result.success) {
    return {
      error: {
        message:
          result.error.formErrors.fieldErrors?.[0]?.[0] ?? 'Changing the organization name failed.',
      },
    };
  }

  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

  const organization = await injector.get(OrganizationManager).updateName({
    name: input.name,
    organization: organizationId,
  });

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'ORGANIZATION_SETTINGS_UPDATED',
      organizationSettingsUpdatedAuditLogSchema: {
        updatedFields: JSON.stringify({
          newOrgName: input.name,
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
    ok: {
      updatedOrganizationPayload: {
        selector: {
          organization: organization.cleanId,
        },
        organization,
      },
    },
  };
};
