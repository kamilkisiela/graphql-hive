import { z } from 'zod';
import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { TargetManager } from '../../providers/target-manager';
import { PercentageModel } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateTargetValidationSettings: NonNullable<
  MutationResolvers['updateTargetValidationSettings']
> = async (_, { input }, { injector }) => {
  const translator = injector.get(IdTranslator);
  const [organization, project, target] = await Promise.all([
    translator.translateOrganizationId(input),
    translator.translateProjectId(input),
    translator.translateTargetId(input),
  ]);

  const org = await injector.get(OrganizationManager).getOrganization({ organization });

  const UpdateTargetValidationSettingsModel = z.object({
    percentage: PercentageModel,
    period: z.number().min(1).max(org.monthlyRateLimit.retentionInDays).int(),
    targets: z.array(z.string()).min(1),
    excludedClients: z.optional(z.array(z.string())),
  });

  const result = UpdateTargetValidationSettingsModel.safeParse(input);

  if (!result.success) {
    return {
      error: {
        message: 'Please check your input.',
        inputErrors: {
          percentage: result.error.formErrors.fieldErrors.percentage?.[0],
          period: result.error.formErrors.fieldErrors.period?.[0],
        },
      },
    };
  }

  const targetManager = injector.get(TargetManager);
  await targetManager.updateTargetValidationSettings({
    period: input.period,
    percentage: input.percentage,
    target,
    project,
    organization,
    targets: result.data.targets,
    excludedClients: result.data.excludedClients ?? [],
  });

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'TARGET_SETTINGS_UPDATED',
      targetSettingsUpdatedAuditLogSchema: {
        projectId: project,
        targetId: target,
        updatedFields: JSON.stringify({
          validationSettings: {
            period: input.period,
            percentage: input.percentage,
            targets: result.data.targets,
            excludedClients: result.data.excludedClients,
          },
        }),
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
      target: await targetManager.getTarget({
        organization,
        project,
        target,
      }),
    },
  };
};
