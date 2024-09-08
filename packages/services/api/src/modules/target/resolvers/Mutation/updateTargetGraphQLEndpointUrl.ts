import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { TargetManager } from '../../providers/target-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const updateTargetGraphQLEndpointUrl: NonNullable<
  MutationResolvers['updateTargetGraphQLEndpointUrl']
> = async (_, { input }, { injector }) => {
  const translator = injector.get(IdTranslator);
  const [organizationId, projectId, targetId] = await Promise.all([
    translator.translateOrganizationId(input),
    translator.translateProjectId(input),
    translator.translateTargetId(input),
  ]);

  const result = await injector.get(TargetManager).updateTargetGraphQLEndpointUrl({
    organizationId,
    projectId,
    targetId,
    graphqlEndpointUrl: input.graphqlEndpointUrl ?? null,
  });

  if (result.type === 'error') {
    return {
      error: {
        message: result.reason,
      },
    };
  }

  // Audit Log Event
  const currentUser = await injector.get(AuthManager).getCurrentUser();
  const allUpdatedFields = JSON.stringify({
    graphqlEndpointUrl: input.graphqlEndpointUrl,
  });

  await injector.get(AuditLogManager).createLogAuditEvent({
    eventTime: new Date().toISOString(),
    eventType: 'TARGET_SETTINGS_UPDATED',
    organizationId: organizationId,
    user: {
      userId: currentUser.id,
      userEmail: currentUser.email,
    },
    TargetSettingsUpdatedAuditLogSchema: {
      projectId: projectId,
      targetId: targetId,
      updatedFields: allUpdatedFields,
    },
  });

  return {
    ok: {
      target: result.target,
    },
  };
};
