import { z } from 'zod';
import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { TokenManager } from '../../providers/token-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

const TokenNameModel = z.string().min(2).max(50);

export const createToken: NonNullable<MutationResolvers['createToken']> = async (
  _parent,
  { input },
  { injector },
) => {
  const CreateTokenInputModel = z.object({
    name: TokenNameModel,
  });

  const result = CreateTokenInputModel.safeParse(input);

  if (!result.success) {
    return {
      error: {
        message: result.error.formErrors.fieldErrors.name?.[0] ?? 'Please check your input.',
      },
    };
  }

  const translator = injector.get(IdTranslator);
  const [organization, project, target] = await Promise.all([
    translator.translateOrganizationId(input),
    translator.translateProjectId(input),
    translator.translateTargetId(input),
  ]);
  const token = await injector.get(TokenManager).createToken({
    name: input.name,
    target,
    project,
    organization,
    organizationScopes: input.organizationScopes,
    projectScopes: input.projectScopes,
    targetScopes: input.targetScopes,
  });

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'TARGET_SETTINGS_UPDATED',
      targetSettingsUpdatedAuditLogSchema: {
        targetId: target,
        projectId: project,
        updatedFields: JSON.stringify({
          createNewToken: true,
          name: input.name,
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
      selector: {
        organization: input.organization,
        project: input.project,
        target: input.target,
      },
      createdToken: token,
      secret: token.secret,
    },
  };
};
