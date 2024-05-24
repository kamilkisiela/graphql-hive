import { AppDeploymentsManager } from '../../providers/app-deployments-manager';
import type { MutationResolvers } from './../../../../__generated__/types.next';

export const activateAppDeployment: NonNullable<
  MutationResolvers['activateAppDeployment']
> = async (_parent, { input }, { injector }) => {
  const result = await injector.get(AppDeploymentsManager).activateAppDeployment({
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
      activatedAppDeployment: result.appDeployment,
    },
  };
};
