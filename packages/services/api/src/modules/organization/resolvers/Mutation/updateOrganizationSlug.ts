import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import { OrganizationSlugModel } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateOrganizationSlug: NonNullable<
  MutationResolvers['updateOrganizationSlug']
> = async (_, { input }, { injector }) => {
  const parsedInput = OrganizationSlugModel.safeParse(input.slug.trim());

  if (!parsedInput.success) {
    return {
      error: {
        message:
          parsedInput.error.formErrors.fieldErrors?.[0]?.[0] ??
          'Changing the organization slug failed.',
      },
    };
  }

  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);
  const result = await injector.get(OrganizationManager).updateSlug({
    slug: input.slug,
    organization: organizationId,
  });

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'ORGANIZATION_SETTINGS_UPDATED',
      organizationSettingsUpdatedAuditLogSchema: {
        updatedFields: JSON.stringify({
          newSlug: input.slug,
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

  if (result.ok) {
    return {
      ok: {
        updatedOrganizationPayload: {
          selector: {
            organization: result.organization.cleanId,
          },
          organization: result.organization,
        },
      },
    };
  }

  return {
    ok: null,
    error: {
      message: result.message,
    },
  };
};
