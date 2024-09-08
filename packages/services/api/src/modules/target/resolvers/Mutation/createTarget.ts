import { z } from 'zod';
import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { TargetManager } from '../../providers/target-manager';
import { TargetNameModel } from '../../validation';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const createTarget: NonNullable<MutationResolvers['createTarget']> = async (
  _,
  { input },
  { injector },
) => {
  const CreateTargetModel = z.object({
    name: TargetNameModel,
  });

  const result = CreateTargetModel.safeParse(input);
  if (!result.success) {
    return {
      error: {
        message: 'Check your input.',
        inputErrors: {
          name: result.error.formErrors.fieldErrors.name?.[0],
        },
      },
    };
  }

  const translator = injector.get(IdTranslator);
  const [organization, project] = await Promise.all([
    translator.translateOrganizationId({
      organization: input.organization,
    }),
    translator.translateProjectId({
      organization: input.organization,
      project: input.project,
    }),
  ]);
  const target = await injector.get(TargetManager).createTarget({
    organization,
    project,
    name: input.name,
  });

  // Audit Log Event
  const currentUser = await injector.get(AuthManager).getCurrentUser();
  await injector.get(AuditLogManager).createLogAuditEvent({
    eventTime: new Date().toISOString(),
    eventType: 'TARGET_CREATED',
    organizationId: target.orgId,
    user: {
      userId: currentUser.id,
      userEmail: currentUser.email,
    },
    TargetCreatedAuditLogSchema: {
      projectId: target.projectId,
      targetId: target.id,
      targetName: target.name,
    },
  });

  return {
    ok: {
      selector: {
        organization: input.organization,
        project: input.project,
        target: target.cleanId,
      },
      createdTarget: target,
    },
  };
};
