import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { AppDeploymentsManager } from '../../providers/app-deployments-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const addDocumentsToAppDeployment: NonNullable<
  MutationResolvers['addDocumentsToAppDeployment']
> = async (_parent, { input }, { injector }) => {
  const result = await injector.get(AppDeploymentsManager).addDocumentsToAppDeployment({
    appDeployment: {
      name: input.appName,
      version: input.appVersion,
    },
    documents: input.documents,
  });

  if (result.type === 'error') {
    return {
      error: {
        message: result.error.message,
        details: result.error.details,
      },
      ok: null,
    };
  }

  const currentUser = await injector.get(AuthManager).getCurrentUser();
  const organization = await injector.get(AuthManager).getOrganizationOwnerByToken();
  await injector.get(AuditLogManager).createLogAuditEvent(
    {
      eventType: 'APP_DEPLOYMENT_UPDATED',
      appDeploymentUpdatedAuditLogSchema: {
        deploymentId: result.appDeployment.id,
        updatedFields: JSON.stringify({
          name: result.appDeployment.name,
          version: result.appDeployment.version,
          documents: input.documents,
        }),
      },
    },
    {
      userId: currentUser.id,
      userEmail: currentUser.email,
      organizationId: organization.id,
      user: currentUser,
    },
  );

  return {
    error: null,
    ok: {
      appDeployment: result.appDeployment,
    },
  };
};
