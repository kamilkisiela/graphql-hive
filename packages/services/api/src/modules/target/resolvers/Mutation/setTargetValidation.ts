import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { TargetManager } from '../../providers/target-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const setTargetValidation: NonNullable<MutationResolvers['setTargetValidation']> = async (
  _,
  { input },
  { injector },
) => {
  const translator = injector.get(IdTranslator);
  const [organization, project, target] = await Promise.all([
    translator.translateOrganizationId(input),
    translator.translateProjectId(input),
    translator.translateTargetId(input),
  ]);

  const targetManager = injector.get(TargetManager);
  await targetManager.setTargetValidation({
    organization,
    project,
    target,
    enabled: input.enabled,
  });

  const result = await targetManager.getTarget({
    organization,
    project,
    target,
  });

  // Audit Log Event
  const currentUser = await injector.get(AuthManager).getCurrentUser();
  const allUpdatedFields = JSON.stringify({
    enabled: input.enabled,
    graphqlEndpointUrl: result.graphqlEndpointUrl,
  });

  await injector.get(AuditLogManager).createLogAuditEvent({
    eventTime: new Date().toISOString(),
    eventType: 'TARGET_SETTINGS_UPDATED',
    organizationId: organization,
    user: {
      userId: currentUser.id,
      userEmail: currentUser.email,
    },
    TargetSettingsUpdatedAuditLogSchema: {
      projectId: project,
      targetId: target,
      updatedFields: allUpdatedFields,
    },
  });

  return result;
};
