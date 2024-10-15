import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { AppDeploymentsManager } from '../../providers/app-deployments-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const retireAppDeployment: NonNullable<MutationResolvers['retireAppDeployment']> = async (
  _parent,
  { input },
  { injector },
) => {
  const result = await injector.get(AppDeploymentsManager).retireAppDeployment({
    targetId: input.targetId,
    appDeployment: {
      name: input.appName,
      version: input.appVersion,
    },
  });

  if (result.type === 'error') {
    return {
      error: {
        message: result.message,
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
          status: 'RETIRED',
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
      retiredAppDeployment: result.appDeployment,
    },
  };
};
