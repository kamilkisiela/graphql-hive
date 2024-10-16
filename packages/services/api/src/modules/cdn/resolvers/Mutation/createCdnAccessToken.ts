import { HiveError } from '../../../../shared/errors';
import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { CdnProvider } from '../../providers/cdn.provider';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const createCdnAccessToken: NonNullable<MutationResolvers['createCdnAccessToken']> = async (
  _,
  { input },
  { injector },
) => {
  const translator = injector.get(IdTranslator);
  const cdn = injector.get(CdnProvider);

  if (cdn.isEnabled() === false) {
    throw new HiveError(`CDN is not configured, cannot generate a token.`);
  }

  const [organizationId, projectId, targetId] = await Promise.all([
    translator.translateOrganizationId(input.selector),
    translator.translateProjectId(input.selector),
    translator.translateTargetId(input.selector),
  ]);

  const result = await cdn.createCDNAccessToken({
    organizationId,
    projectId,
    targetId,
    alias: input.alias,
  });

  if (result.type === 'failure') {
    return {
      error: {
        message: result.reason,
      },
    };
  }

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'TARGET_SETTINGS_UPDATED',
      targetSettingsUpdatedAuditLogSchema: {
        targetId: targetId,
        projectId: projectId,
        updatedFields: JSON.stringify({
          createNewCdnAccessToken: true,
          alias: input.alias,
        }),
      },
    },
    {
      organizationId,
      userEmail: currentUser.email,
      userId: currentUser.id,
      user: currentUser,
    },
  );

  return {
    ok: {
      secretAccessToken: result.secretAccessToken,
      createdCdnAccessToken: result.cdnAccessToken,
      cdnUrl: cdn.getCdnUrlForTarget(targetId),
    },
  };
};
