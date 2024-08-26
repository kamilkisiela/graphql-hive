import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { GitHubIntegrationManager } from '../../providers/github-integration-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const enableProjectNameInGithubCheck: NonNullable<
  MutationResolvers['enableProjectNameInGithubCheck']
> = async (_, { input }, { injector }) => {
  const translator = injector.get(IdTranslator);
  const [organization, project] = await Promise.all([
    translator.translateOrganizationId(input),
    translator.translateProjectId(input),
  ]);
  const result = injector.get(GitHubIntegrationManager).enableProjectNameInGithubCheck({
    organization,
    project,
  });

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'ORGANIZATION_UPDATED_INTEGRATION',
      organizationUpdatedIntegrationAuditLogSchema: {
        integrationId: null,
        updatedFields: JSON.stringify({
          github: {
            enableProjectNameInGithubCheck: true,
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

  return result;
};
