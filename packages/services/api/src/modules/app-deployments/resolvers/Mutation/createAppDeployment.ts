import { AuditLogManager } from '../../../audit-logs/providers/audit-logs-manager';
import { AuthManager } from '../../../auth/providers/auth-manager';
import { AppDeploymentsManager } from '../../providers/app-deployments-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const createAppDeployment: NonNullable<MutationResolvers['createAppDeployment']> = async (
  _parent,
  { input },
  { injector },
) => {
  const result = await injector.get(AppDeploymentsManager).createAppDeployment({
    appDeployment: {
      name: input.appName,
      version: input.appVersion,
    },
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
      eventType: 'APP_DEPLOYMENT_CREATED',
      appDeploymentCreatedAuditLogSchema: {
        deploymentId: result.appDeployment.id,
        deploymentName: result.appDeployment.name,
        deploymentVersion: result.appDeployment.version,
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
      createdAppDeployment: result.appDeployment,
    },
  };
};
