import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { OrganizationManager } from '../../providers/organization-manager';
import { createOrUpdateMemberRoleInputSchema } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateMemberRole: NonNullable<MutationResolvers['updateMemberRole']> = async (
  _,
  { input },
  { injector },
) => {
  const inputValidation = createOrUpdateMemberRoleInputSchema.safeParse({
    name: input.name,
    description: input.description,
  });

  if (!inputValidation.success) {
    return {
      error: {
        message: 'Please check your input.',
        inputErrors: {
          name: inputValidation.error.formErrors.fieldErrors.name?.[0],
          description: inputValidation.error.formErrors.fieldErrors.description?.[0],
        },
      },
    };
  }
  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

  const result = await injector.get(OrganizationManager).updateMemberRole({
    organizationId,
    roleId: input.role,
    name: inputValidation.data.name,
    description: inputValidation.data.description,
    organizationAccessScopes: input.organizationAccessScopes,
    projectAccessScopes: input.projectAccessScopes,
    targetAccessScopes: input.targetAccessScopes,
  });

  if (result.ok) {
    const currentUser = await injector.get(AuthManager).getCurrentUser();
    injector.get(AuditLogManager).createLogAuditEvent(
      {
        eventType: 'ROLE_UPDATED',
        roleUpdatedAuditLogSchema: {
          roleId: input.role,
          roleName: inputValidation.data.name,
          updatedFields: JSON.stringify({
            description: result.ok.updatedRole.description,
            locked: result.ok.updatedRole.locked,
            organizationAccessScopes: input.organizationAccessScopes,
            projectAccessScopes: input.projectAccessScopes,
            targetAccessScopes: input.targetAccessScopes,
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
  }

  return result;
};
