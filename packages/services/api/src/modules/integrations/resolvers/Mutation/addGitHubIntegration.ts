import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { GitHubIntegrationManager } from '../../providers/github-integration-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const addGitHubIntegration: NonNullable<MutationResolvers['addGitHubIntegration']> = async (
  _,
  { input },
  { injector },
) => {
  const organization = await injector.get(IdTranslator).translateOrganizationId(input);

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'ORGANIZATION_UPDATED_INTEGRATION',
      organizationUpdatedIntegrationAuditLogSchema: {
        integrationId: input.installationId,
        updatedFields: JSON.stringify({
          github: {
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

  await injector.get(GitHubIntegrationManager).register({
    organization,
    installationId: input.installationId,
  });

  return true;
};
