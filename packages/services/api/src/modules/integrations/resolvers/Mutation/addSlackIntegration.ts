import { z } from 'zod';
import { HiveError } from '../../../../shared/errors';
import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { SlackIntegrationManager } from '../../providers/slack-integration-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

/**
 * Current token size is 255 characters.
 * We allow some more for being future-proof :)
 *
 * https://api.slack.com/changelog/2016-08-23-token-lengthening
 */
const SlackTokenModel = z.string().min(1).max(1000);

export const addSlackIntegration: NonNullable<MutationResolvers['addSlackIntegration']> = async (
  _,
  { input },
  { injector },
) => {
  const AddSlackTokenIntegrationModel = z.object({
    token: SlackTokenModel,
  });

  const result = AddSlackTokenIntegrationModel.safeParse(input);

  if (!result.success) {
    throw new HiveError(
      result.error.formErrors.fieldErrors.token?.[0] ?? 'Please check your input.',
    );
  }

  const organization = await injector.get(IdTranslator).translateOrganizationId(input);

  await injector.get(SlackIntegrationManager).register({
    organization,
    token: input.token,
  });

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'ORGANIZATION_UPDATED_INTEGRATION',
      organizationUpdatedIntegrationAuditLogSchema: {
        integrationId: null,
        updatedFields: JSON.stringify({
          slack: {
            added: true,
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

  return true;
};
