import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { OrganizationManager } from '../../../organization/providers/organization-manager';
import { IdTranslator } from '../../../shared/providers/id-translator';
import { GitHubIntegrationManager } from '../../providers/github-integration-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const deleteGitHubIntegration: NonNullable<
  MutationResolvers['deleteGitHubIntegration']
> = async (_, { input }, { injector }) => {
  const organizationId = await injector.get(IdTranslator).translateOrganizationId(input);

  await injector.get(GitHubIntegrationManager).unregister({
    organization: organizationId,
  });

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'ORGANIZATION_UPDATED_INTEGRATION',
      organizationUpdatedIntegrationAuditLogSchema: {
        integrationId: null,
        updatedFields: JSON.stringify({
          github: {
            unregister: true,
          },
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

  const organization = await injector.get(OrganizationManager).getOrganization({
    organization: organizationId,
  });
  return { organization };
};
