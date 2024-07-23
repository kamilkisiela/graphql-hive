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

  return {
    error: null,
    ok: {
      retiredAppDeployment: result.appDeployment,
    },
  };
};
